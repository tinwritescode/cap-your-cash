-- Protected writes used by the application data layer.
CREATE OR REPLACE FUNCTION public.update_profile(p_patch jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH:Not authenticated'; END IF;
  UPDATE public.profiles
  SET display_name = CASE WHEN p_patch ? 'display_name' THEN NULLIF(trim(p_patch->>'display_name'), '') ELSE display_name END,
      avatar_path = CASE WHEN p_patch ? 'avatar_path' THEN NULLIF(p_patch->>'avatar_path', '') ELSE avatar_path END,
      theme = CASE WHEN p_patch ? 'theme' THEN p_patch->>'theme' ELSE theme END,
      hide_amounts = CASE WHEN p_patch ? 'hide_amounts' THEN (p_patch->>'hide_amounts')::boolean ELSE hide_amounts END,
      tutorial_status = CASE WHEN p_patch ? 'tutorial_status' THEN p_patch->>'tutorial_status' ELSE tutorial_status END,
      font = CASE WHEN p_patch ? 'font' THEN p_patch->>'font' ELSE font END,
      updated_at = now()
  WHERE id = auth.uid();
END $$;

CREATE OR REPLACE FUNCTION public.create_wallet(p_name text, p_kind text, p_opening_balance_vnd bigint, p_opening_at timestamptz)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH:Not authenticated'; END IF;
  INSERT INTO public.wallets(name, kind, opening_balance_vnd, opening_at)
  VALUES (p_name, p_kind, p_opening_balance_vnd, p_opening_at)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.rename_wallet(p_id uuid, p_name text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.wallets SET name = p_name WHERE id = p_id AND owner_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.archive_wallet(p_id uuid, p_archived boolean)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.wallets SET archived_at = CASE WHEN p_archived THEN now() ELSE NULL END
  WHERE id = p_id AND owner_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.create_category(p_name text, p_icon text, p_type text, p_parent_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH:Not authenticated'; END IF;
  INSERT INTO public.categories(name, icon, type, parent_id)
  VALUES (p_name, COALESCE(NULLIF(p_icon, ''), '📦'), p_type, p_parent_id)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.archive_category(p_id uuid, p_archived boolean)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.categories SET archived_at = CASE WHEN p_archived THEN now() ELSE NULL END
  WHERE id = p_id AND owner_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.upsert_monthly_budget(p_month date, p_amount_vnd bigint)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.monthly_budgets(owner_id, month, amount_vnd)
  VALUES (auth.uid(), p_month, p_amount_vnd)
  ON CONFLICT (owner_id, month) DO UPDATE SET amount_vnd = EXCLUDED.amount_vnd, updated_at = now()
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.delete_monthly_budget(p_month date)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM public.monthly_budgets WHERE owner_id = auth.uid() AND month = p_month;
$$;

GRANT EXECUTE ON FUNCTION public.update_profile(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_wallet(text,text,bigint,timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rename_wallet(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_wallet(uuid,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_category(text,text,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_category(uuid,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_monthly_budget(date,bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_monthly_budget(date) TO authenticated;
