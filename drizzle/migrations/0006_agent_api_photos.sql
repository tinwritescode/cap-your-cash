CREATE OR REPLACE FUNCTION public.api_dispatch(p_key text, p_action text, p_args jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid; a jsonb := coalesce(p_args,'{}'::jsonb); m date; r jsonb; v_id uuid; t record;
BEGIN
  SELECT owner_id INTO uid FROM public.api_keys
   WHERE key_hash = encode(sha256(convert_to(coalesce(p_key,''),'UTF8')),'hex') AND revoked_at IS NULL;
  IF uid IS NULL THEN RAISE EXCEPTION 'AUTH:API key không hợp lệ hoặc đã bị thu hồi'; END IF;
  UPDATE public.api_keys SET last_used_at = now() WHERE key_hash = encode(sha256(convert_to(p_key,'UTF8')),'hex');
  PERFORM set_config('request.jwt.claim.sub', uid::text, true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', uid, 'role', 'authenticated')::text, true);
  m := coalesce((a->>'month')::date, (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date);

  CASE p_action
  WHEN 'me' THEN
    SELECT jsonb_build_object('id', p.id, 'display_name', p.display_name, 'theme', p.theme, 'accent', p.accent, 'font', p.font)
      INTO r FROM public.profiles p WHERE p.id = uid;
  WHEN 'wallets.list' THEN
    SELECT coalesce(jsonb_agg(to_jsonb(w) - 'owner_id' || jsonb_build_object('balance_vnd', b.balance_vnd) ORDER BY w.created_at), '[]')
      INTO r FROM public.wallets w LEFT JOIN public.wallet_balances() b ON b.wallet_id = w.id WHERE w.owner_id = uid;
  WHEN 'wallets.create' THEN
    INSERT INTO public.wallets(owner_id, name, kind, opening_balance_vnd)
    VALUES (uid, a->>'name', coalesce(a->>'kind','cash'), coalesce((a->>'opening_balance_vnd')::bigint, 0))
    RETURNING id INTO v_id;
    r := jsonb_build_object('id', v_id);
  WHEN 'categories.list' THEN
    SELECT coalesce(jsonb_agg(to_jsonb(c) - 'owner_id' ORDER BY c.created_at), '[]') INTO r
      FROM public.categories c WHERE c.owner_id = uid AND (a->>'type' IS NULL OR c.type = a->>'type');
  WHEN 'categories.create' THEN
    INSERT INTO public.categories(owner_id, name, type, icon, parent_id)
    VALUES (uid, a->>'name', a->>'type', coalesce(nullif(a->>'icon',''),'📦'), (a->>'parent_id')::uuid)
    RETURNING id INTO v_id;
    r := jsonb_build_object('id', v_id);
  WHEN 'transactions.list' THEN
    SELECT coalesce(jsonb_agg(to_jsonb(t) - 'owner_id' - 'create_fingerprint' ORDER BY t.occurred_at DESC), '[]') INTO r
    FROM (SELECT * FROM public.transactions t
          WHERE t.owner_id = uid AND t.deleted_at IS NULL
            AND t.occurred_at >= (date_trunc('month', m)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')
            AND t.occurred_at < ((date_trunc('month', m) + interval '1 month')::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')
            AND (a->>'type' IS NULL OR t.type = a->>'type')
            AND (a->>'wallet_id' IS NULL OR t.source_wallet_id = (a->>'wallet_id')::uuid OR t.dest_wallet_id = (a->>'wallet_id')::uuid)
          ORDER BY t.occurred_at DESC
          LIMIT least(coalesce((a->>'limit')::int, 100), 500)) t;
  WHEN 'transactions.get' THEN
    SELECT to_jsonb(t) - 'owner_id' - 'create_fingerprint' || jsonb_build_object('photos',
        coalesce((SELECT jsonb_agg(jsonb_build_object('id',p.id,'sort_order',p.sort_order) ORDER BY p.sort_order)
                  FROM public.transaction_photos p WHERE p.transaction_id = t.id), '[]'::jsonb))
      INTO r FROM public.transactions t
     WHERE t.id = (a->>'id')::uuid AND t.owner_id = uid AND (t.deleted_at IS NULL OR t.deleted_at > now() - interval '30 days');
    IF r IS NULL THEN RAISE EXCEPTION 'NOT_FOUND:Không tìm thấy giao dịch'; END IF;
  WHEN 'transactions.create' THEN
    r := public.commit_transaction(coalesce((a->>'id')::uuid, gen_random_uuid()), a->>'type', (a->>'amount_vnd')::bigint,
      (a->>'source_wallet_id')::uuid, (a->>'dest_wallet_id')::uuid, (a->>'category_id')::uuid,
      coalesce((a->>'occurred_at')::timestamptz, now()), a->>'note', coalesce(a->'photos','[]'::jsonb));
  WHEN 'transactions.update' THEN
    r := public.update_transaction((a->>'id')::uuid, (a->>'version')::int, (a->>'amount_vnd')::bigint,
      (a->>'source_wallet_id')::uuid, (a->>'dest_wallet_id')::uuid, (a->>'category_id')::uuid,
      (a->>'occurred_at')::timestamptz, a->>'note',
      coalesce((SELECT jsonb_agg(jsonb_build_object('id',p.id,'original_path',p.original_path,'thumb_path',p.thumb_path,'sort_order',p.sort_order))
                FROM public.transaction_photos p WHERE p.transaction_id = (a->>'id')::uuid AND p.owner_id = uid), '[]'::jsonb));
  WHEN 'transactions.photos.add' THEN
    SELECT * INTO t FROM public.transactions WHERE id = (a->>'id')::uuid AND owner_id = uid AND deleted_at IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND:Không tìm thấy giao dịch'; END IF;
    r := public.update_transaction(t.id, coalesce((a->>'version')::int, t.version), t.amount_vnd,
      t.source_wallet_id, t.dest_wallet_id, t.category_id, t.occurred_at, t.note,
      coalesce((SELECT jsonb_agg(jsonb_build_object('id',p.id,'original_path',p.original_path,'thumb_path',p.thumb_path,'sort_order',p.sort_order))
                FROM public.transaction_photos p WHERE p.transaction_id = t.id AND p.owner_id = uid), '[]'::jsonb)
      || coalesce(a->'photos','[]'::jsonb));
  WHEN 'transactions.trash' THEN
    r := public.trash_transaction((a->>'id')::uuid, (a->>'version')::int);
  WHEN 'transactions.restore' THEN
    r := public.restore_transaction((a->>'id')::uuid, (a->>'version')::int);
  WHEN 'trash.list' THEN
    SELECT coalesce(jsonb_agg(to_jsonb(t) - 'owner_id' - 'create_fingerprint' ORDER BY t.deleted_at DESC), '[]') INTO r
      FROM public.transactions t WHERE t.owner_id = uid AND t.deleted_at IS NOT NULL AND t.deleted_at > now() - interval '30 days';
  WHEN 'reports.summary' THEN
    SELECT to_jsonb(s) INTO r FROM public.month_summary(m, (a->>'wallet_id')::uuid) s;
  WHEN 'reports.daily' THEN
    SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY d.day), '[]') INTO r FROM public.month_daily(m) d;
  WHEN 'reports.categories' THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object('category_id', x.category_id, 'name', c.name, 'icon', c.icon, 'total_vnd', x.total_vnd) ORDER BY x.total_vnd DESC), '[]')
      INTO r FROM public.month_category_expense(m) x LEFT JOIN public.categories c ON c.id = x.category_id;
  WHEN 'budgets.set' THEN
    IF (a->>'amount_vnd')::bigint IS NULL OR (a->>'amount_vnd')::bigint < 0 THEN RAISE EXCEPTION 'VALIDATION:amount_vnd không hợp lệ'; END IF;
    UPDATE public.monthly_budgets SET amount_vnd = (a->>'amount_vnd')::bigint, updated_at = now()
     WHERE owner_id = uid AND month = date_trunc('month', m)::date;
    IF NOT FOUND THEN
      INSERT INTO public.monthly_budgets(owner_id, month, amount_vnd) VALUES (uid, date_trunc('month', m)::date, (a->>'amount_vnd')::bigint);
    END IF;
    r := jsonb_build_object('month', date_trunc('month', m)::date, 'amount_vnd', (a->>'amount_vnd')::bigint);
  ELSE
    RAISE EXCEPTION 'NOT_FOUND:Hành động không tồn tại: %', p_action;
  END CASE;
  RETURN coalesce(r, 'null'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.api_dispatch(text, text, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.api_dispatch(text, text, jsonb) TO anon, authenticated, service_role;