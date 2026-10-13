
-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text CHECK (char_length(display_name) <= 60),
  avatar_path text,
  theme text NOT NULL DEFAULT 'dark' CHECK (theme IN ('dark','light')),
  hide_amounts boolean NOT NULL DEFAULT false,
  tutorial_status text NOT NULL DEFAULT 'unseen' CHECK (tutorial_status IN ('unseen','completed','dismissed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- ============ WALLETS ============
CREATE TABLE public.wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 40),
  kind text NOT NULL CHECK (kind IN ('cash','bank','credit')),
  opening_balance_vnd bigint NOT NULL DEFAULT 0 CHECK (abs(opening_balance_vnd) <= 9000000000000000),
  opening_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, id)
);
CREATE INDEX wallets_owner_idx ON public.wallets(owner_id);
GRANT SELECT, INSERT, UPDATE ON public.wallets TO authenticated;
GRANT ALL ON public.wallets TO service_role;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own wallets read" ON public.wallets FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "own wallets insert" ON public.wallets FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "own wallets update" ON public.wallets FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE OR REPLACE FUNCTION public.wallets_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.owner_id := auth.uid();
    IF NEW.owner_id IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  ELSE
    IF NEW.owner_id <> OLD.owner_id OR NEW.opening_balance_vnd <> OLD.opening_balance_vnd
       OR NEW.opening_at <> OLD.opening_at OR NEW.kind <> OLD.kind OR NEW.id <> OLD.id THEN
      RAISE EXCEPTION 'Chỉ được đổi tên hoặc lưu trữ ví';
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER wallets_guard BEFORE INSERT OR UPDATE ON public.wallets FOR EACH ROW EXECUTE FUNCTION public.wallets_guard();

-- ============ CATEGORIES ============
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 40),
  type text NOT NULL CHECK (type IN ('expense','income')),
  parent_id uuid,
  icon text NOT NULL DEFAULT '📦',
  color text NOT NULL DEFAULT 'blue',
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, id),
  CHECK (parent_id IS NULL OR parent_id <> id),
  FOREIGN KEY (owner_id, parent_id) REFERENCES public.categories(owner_id, id)
);
CREATE INDEX categories_owner_idx ON public.categories(owner_id);
GRANT SELECT, INSERT, UPDATE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own cat read" ON public.categories FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "own cat insert" ON public.categories FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "own cat update" ON public.categories FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE OR REPLACE FUNCTION public.categories_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE p record;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF auth.uid() IS NOT NULL THEN NEW.owner_id := auth.uid(); END IF;
  ELSE
    IF NEW.owner_id <> OLD.owner_id OR NEW.type <> OLD.type THEN RAISE EXCEPTION 'Không thể đổi loại danh mục'; END IF;
    IF NEW.parent_id IS DISTINCT FROM OLD.parent_id AND EXISTS (SELECT 1 FROM public.categories c WHERE c.parent_id = NEW.id) AND NEW.parent_id IS NOT NULL THEN
      RAISE EXCEPTION 'Danh mục có danh mục con không thể trở thành danh mục con';
    END IF;
  END IF;
  IF NEW.parent_id IS NOT NULL THEN
    SELECT * INTO p FROM public.categories WHERE id = NEW.parent_id AND owner_id = NEW.owner_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Danh mục cha không hợp lệ'; END IF;
    IF p.parent_id IS NOT NULL THEN RAISE EXCEPTION 'Chỉ hỗ trợ một cấp danh mục con'; END IF;
    IF p.type <> NEW.type THEN RAISE EXCEPTION 'Danh mục con phải cùng loại'; END IF;
    IF TG_OP = 'INSERT' AND p.archived_at IS NOT NULL THEN RAISE EXCEPTION 'Danh mục cha đã lưu trữ'; END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER categories_guard BEFORE INSERT OR UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.categories_guard();

-- ============ TRANSACTIONS ============
CREATE TABLE public.transactions (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL,
  type text NOT NULL CHECK (type IN ('expense','income','transfer','journal')),
  amount_vnd bigint NOT NULL CHECK (amount_vnd >= 0 AND amount_vnd <= 9000000000000000),
  source_wallet_id uuid,
  dest_wallet_id uuid,
  category_id uuid,
  occurred_at timestamptz NOT NULL,
  note text CHECK (char_length(note) <= 500),
  create_fingerprint text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, id),
  FOREIGN KEY (owner_id, source_wallet_id) REFERENCES public.wallets(owner_id, id),
  FOREIGN KEY (owner_id, dest_wallet_id) REFERENCES public.wallets(owner_id, id),
  FOREIGN KEY (owner_id, category_id) REFERENCES public.categories(owner_id, id),
  CHECK (
    (type = 'expense' AND amount_vnd > 0 AND source_wallet_id IS NOT NULL AND dest_wallet_id IS NULL AND category_id IS NOT NULL) OR
    (type = 'income' AND amount_vnd > 0 AND dest_wallet_id IS NOT NULL AND source_wallet_id IS NULL AND category_id IS NOT NULL) OR
    (type = 'transfer' AND amount_vnd > 0 AND source_wallet_id IS NOT NULL AND dest_wallet_id IS NOT NULL AND source_wallet_id <> dest_wallet_id AND category_id IS NULL) OR
    (type = 'journal' AND amount_vnd = 0 AND dest_wallet_id IS NULL)
  )
);
CREATE INDEX tx_owner_time_idx ON public.transactions(owner_id, occurred_at DESC);
CREATE INDEX tx_src_idx ON public.transactions(owner_id, source_wallet_id);
CREATE INDEX tx_dst_idx ON public.transactions(owner_id, dest_wallet_id);
CREATE INDEX tx_cat_idx ON public.transactions(owner_id, category_id);
CREATE INDEX tx_deleted_idx ON public.transactions(deleted_at) WHERE deleted_at IS NOT NULL;
GRANT SELECT ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own tx read" ON public.transactions FOR SELECT TO authenticated
  USING (owner_id = auth.uid() AND (deleted_at IS NULL OR deleted_at > now() - interval '30 days'));

-- ============ PHOTOS ============
CREATE TABLE public.transaction_photos (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL,
  transaction_id uuid NOT NULL,
  original_path text NOT NULL UNIQUE,
  thumb_path text NOT NULL UNIQUE,
  sort_order smallint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (owner_id, transaction_id) REFERENCES public.transactions(owner_id, id) ON DELETE CASCADE
);
CREATE INDEX photos_tx_idx ON public.transaction_photos(transaction_id);
CREATE INDEX photos_owner_idx ON public.transaction_photos(owner_id, created_at DESC);
GRANT SELECT ON public.transaction_photos TO authenticated;
GRANT ALL ON public.transaction_photos TO service_role;
ALTER TABLE public.transaction_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own photos read" ON public.transaction_photos FOR SELECT TO authenticated
  USING (owner_id = auth.uid() AND EXISTS (SELECT 1 FROM public.transactions t WHERE t.id = transaction_id AND t.owner_id = auth.uid() AND (t.deleted_at IS NULL OR t.deleted_at > now() - interval '30 days')));

-- ============ BUDGETS ============
CREATE TABLE public.monthly_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  month date NOT NULL CHECK (extract(day FROM month) = 1),
  amount_vnd bigint NOT NULL CHECK (amount_vnd >= 0 AND amount_vnd <= 9000000000000000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, month)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.monthly_budgets TO authenticated;
GRANT ALL ON public.monthly_budgets TO service_role;
ALTER TABLE public.monthly_budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own budget all" ON public.monthly_budgets FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- ============ CLEANUP JOBS (server only) ============
CREATE TABLE public.cleanup_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('purge','photo_removed','orphan')),
  transaction_id uuid,
  object_paths text[] NOT NULL DEFAULT '{}',
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','done','failed')),
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
GRANT ALL ON public.cleanup_jobs TO service_role;
ALTER TABLE public.cleanup_jobs ENABLE ROW LEVEL SECURITY;

-- ============ SIGNUP: profile + seed categories ============
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles(id, display_name) VALUES (NEW.id, NULLIF(NEW.raw_user_meta_data->>'full_name',''))
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.categories(owner_id, name, type, icon, color) VALUES
    (NEW.id,'Ăn uống','expense','🍜','orange'),
    (NEW.id,'Cà phê','expense','☕','amber'),
    (NEW.id,'Đi lại','expense','🛵','sky'),
    (NEW.id,'Mua sắm','expense','🛍️','pink'),
    (NEW.id,'Hóa đơn','expense','🧾','violet'),
    (NEW.id,'Giải trí','expense','🎬','rose'),
    (NEW.id,'Sức khỏe','expense','💊','emerald'),
    (NEW.id,'Khác','expense','📦','slate'),
    (NEW.id,'Lương','income','💼','green'),
    (NEW.id,'Thưởng','income','🎁','lime'),
    (NEW.id,'Thu khác','income','💰','teal');
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ TRANSACTION RPCs ============
CREATE OR REPLACE FUNCTION public._tx_validate(
  _uid uuid, _type text, _amount bigint, _src uuid, _dst uuid, _cat uuid, _at timestamptz, _note text,
  _old_src uuid, _old_dst uuid, _old_cat uuid
) RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
DECLARE w record; c record;
BEGIN
  IF _type NOT IN ('expense','income','transfer','journal') THEN RAISE EXCEPTION 'VALIDATION:Loại giao dịch không hợp lệ'; END IF;
  IF _amount IS NULL OR _amount < 0 OR _amount > 9000000000000000 THEN RAISE EXCEPTION 'VALIDATION:Số tiền không hợp lệ'; END IF;
  IF _type <> 'journal' AND _amount = 0 THEN RAISE EXCEPTION 'VALIDATION:Số tiền phải lớn hơn 0'; END IF;
  IF _type = 'journal' AND _amount <> 0 THEN RAISE EXCEPTION 'VALIDATION:Nhật ký ảnh phải là 0đ'; END IF;
  IF _at IS NULL THEN RAISE EXCEPTION 'VALIDATION:Thiếu thời gian'; END IF;
  IF _note IS NOT NULL AND char_length(_note) > 500 THEN RAISE EXCEPTION 'VALIDATION:Ghi chú quá dài'; END IF;
  IF _type = 'expense' AND (_src IS NULL OR _dst IS NOT NULL OR _cat IS NULL) THEN RAISE EXCEPTION 'VALIDATION:Khoản chi cần ví và danh mục'; END IF;
  IF _type = 'income' AND (_dst IS NULL OR _src IS NOT NULL OR _cat IS NULL) THEN RAISE EXCEPTION 'VALIDATION:Khoản thu cần ví và danh mục'; END IF;
  IF _type = 'transfer' AND (_src IS NULL OR _dst IS NULL OR _src = _dst OR _cat IS NOT NULL) THEN RAISE EXCEPTION 'VALIDATION:Chuyển ví cần hai ví khác nhau'; END IF;
  IF _type = 'journal' AND _dst IS NOT NULL THEN RAISE EXCEPTION 'VALIDATION:Nhật ký không có ví nhận'; END IF;
  FOR w IN SELECT * FROM public.wallets WHERE id IN (_src, _dst) LOOP NULL; END LOOP;
  IF _src IS NOT NULL THEN
    SELECT * INTO w FROM public.wallets WHERE id = _src AND owner_id = _uid;
    IF NOT FOUND THEN RAISE EXCEPTION 'VALIDATION:Ví không tồn tại'; END IF;
    IF w.archived_at IS NOT NULL AND _src IS DISTINCT FROM _old_src THEN RAISE EXCEPTION 'VALIDATION:Ví "%" đã lưu trữ', w.name; END IF;
    IF _type <> 'journal' AND _at < w.opening_at THEN RAISE EXCEPTION 'VALIDATION:Thời gian trước ngày bắt đầu của ví "%"', w.name; END IF;
  END IF;
  IF _dst IS NOT NULL THEN
    SELECT * INTO w FROM public.wallets WHERE id = _dst AND owner_id = _uid;
    IF NOT FOUND THEN RAISE EXCEPTION 'VALIDATION:Ví không tồn tại'; END IF;
    IF w.archived_at IS NOT NULL AND _dst IS DISTINCT FROM _old_dst THEN RAISE EXCEPTION 'VALIDATION:Ví "%" đã lưu trữ', w.name; END IF;
    IF _at < w.opening_at THEN RAISE EXCEPTION 'VALIDATION:Thời gian trước ngày bắt đầu của ví "%"', w.name; END IF;
  END IF;
  IF _cat IS NOT NULL THEN
    SELECT * INTO c FROM public.categories WHERE id = _cat AND owner_id = _uid;
    IF NOT FOUND THEN RAISE EXCEPTION 'VALIDATION:Danh mục không tồn tại'; END IF;
    IF c.archived_at IS NOT NULL AND _cat IS DISTINCT FROM _old_cat THEN RAISE EXCEPTION 'VALIDATION:Danh mục đã lưu trữ'; END IF;
    IF _type = 'income' AND c.type <> 'income' THEN RAISE EXCEPTION 'VALIDATION:Danh mục không phù hợp'; END IF;
    IF _type IN ('expense','journal') AND c.type <> 'expense' THEN RAISE EXCEPTION 'VALIDATION:Danh mục không phù hợp'; END IF;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public._tx_validate(uuid,text,bigint,uuid,uuid,uuid,timestamptz,text,uuid,uuid,uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._photos_validate(_uid uuid, _tx uuid, _photos jsonb) RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
DECLARE p jsonb; prefix text := _uid::text || '/' || _tx::text || '/';
BEGIN
  IF _photos IS NULL OR jsonb_typeof(_photos) <> 'array' THEN RAISE EXCEPTION 'VALIDATION:Danh sách ảnh không hợp lệ'; END IF;
  IF jsonb_array_length(_photos) > 5 THEN RAISE EXCEPTION 'VALIDATION:Tối đa 5 ảnh mỗi giao dịch'; END IF;
  FOR p IN SELECT * FROM jsonb_array_elements(_photos) LOOP
    IF (p->>'id') IS NULL OR left(p->>'original_path', length(prefix)) <> prefix OR left(p->>'thumb_path', length(prefix)) <> prefix
       OR (p->>'original_path') LIKE '%..%' OR (p->>'thumb_path') LIKE '%..%' THEN
      RAISE EXCEPTION 'VALIDATION:Đường dẫn ảnh không hợp lệ';
    END IF;
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public._photos_validate(uuid,uuid,jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.commit_transaction(
  p_id uuid, p_type text, p_amount bigint, p_source uuid, p_dest uuid, p_category uuid,
  p_occurred_at timestamptz, p_note text, p_photos jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); fp text; existing record; note_n text := NULLIF(trim(coalesce(p_note,'')),''); p jsonb; photos_n jsonb;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'AUTH:Chưa đăng nhập'; END IF;
  IF p_id IS NULL THEN RAISE EXCEPTION 'VALIDATION:Thiếu mã giao dịch'; END IF;
  photos_n := coalesce((SELECT jsonb_agg(jsonb_build_object('id',e->>'id','o',e->>'original_path','t',e->>'thumb_path') ORDER BY (e->>'sort_order')::int, e->>'id') FROM jsonb_array_elements(coalesce(p_photos,'[]'::jsonb)) e), '[]'::jsonb);
  fp := md5(jsonb_build_object('type',p_type,'amount',p_amount::text,'src',p_source,'dst',p_dest,'cat',p_category,
    'at', to_char(p_occurred_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US'),'note',note_n,'photos',photos_n)::text);
  SELECT * INTO existing FROM public.transactions WHERE id = p_id FOR UPDATE;
  IF FOUND THEN
    IF existing.owner_id = uid AND existing.create_fingerprint = fp THEN
      RETURN jsonb_build_object('status','duplicate','id',p_id,'version',existing.version);
    END IF;
    RETURN jsonb_build_object('status','conflict','message','Mã giao dịch đã được dùng cho nội dung khác');
  END IF;
  PERFORM public._tx_validate(uid, p_type, p_amount, p_source, p_dest, p_category, p_occurred_at, note_n, NULL, NULL, NULL);
  PERFORM public._photos_validate(uid, p_id, coalesce(p_photos,'[]'::jsonb));
  IF p_type = 'journal' AND jsonb_array_length(coalesce(p_photos,'[]'::jsonb)) = 0 THEN RAISE EXCEPTION 'VALIDATION:Nhật ký ảnh cần ít nhất một ảnh'; END IF;
  INSERT INTO public.transactions(id, owner_id, type, amount_vnd, source_wallet_id, dest_wallet_id, category_id, occurred_at, note, create_fingerprint)
  VALUES (p_id, uid, p_type, p_amount, p_source, p_dest, p_category, p_occurred_at, note_n, fp);
  FOR p IN SELECT * FROM jsonb_array_elements(coalesce(p_photos,'[]'::jsonb)) LOOP
    INSERT INTO public.transaction_photos(id, owner_id, transaction_id, original_path, thumb_path, sort_order)
    VALUES ((p->>'id')::uuid, uid, p_id, p->>'original_path', p->>'thumb_path', coalesce((p->>'sort_order')::smallint,0));
  END LOOP;
  RETURN jsonb_build_object('status','created','id',p_id,'version',1);
END $$;

CREATE OR REPLACE FUNCTION public.update_transaction(
  p_id uuid, p_version int, p_amount bigint, p_source uuid, p_dest uuid, p_category uuid,
  p_occurred_at timestamptz, p_note text, p_photos jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); t record; p jsonb; removed text[]; note_n text := NULLIF(trim(coalesce(p_note,'')),''); keep uuid[];
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'AUTH:Chưa đăng nhập'; END IF;
  SELECT * INTO t FROM public.transactions WHERE id = p_id AND owner_id = uid FOR UPDATE;
  IF NOT FOUND OR t.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'VALIDATION:Giao dịch không tồn tại hoặc đã ở thùng rác'; END IF;
  IF t.version <> p_version THEN RETURN jsonb_build_object('status','conflict','message','Giao dịch đã được thay đổi ở nơi khác. Hãy tải lại.'); END IF;
  PERFORM public._tx_validate(uid, t.type, p_amount, p_source, p_dest, p_category, p_occurred_at, note_n, t.source_wallet_id, t.dest_wallet_id, t.category_id);
  PERFORM public._photos_validate(uid, p_id, coalesce(p_photos,'[]'::jsonb));
  IF t.type = 'journal' AND jsonb_array_length(coalesce(p_photos,'[]'::jsonb)) = 0 THEN RAISE EXCEPTION 'VALIDATION:Nhật ký ảnh cần ít nhất một ảnh'; END IF;
  SELECT coalesce(array_agg((e->>'id')::uuid),'{}') INTO keep FROM jsonb_array_elements(coalesce(p_photos,'[]'::jsonb)) e;
  SELECT coalesce(array_agg(x),'{}') INTO removed FROM (
    SELECT unnest(ARRAY[original_path, thumb_path]) x FROM public.transaction_photos WHERE transaction_id = p_id AND NOT (id = ANY(keep))) s;
  DELETE FROM public.transaction_photos WHERE transaction_id = p_id AND NOT (id = ANY(keep));
  IF array_length(removed,1) > 0 THEN INSERT INTO public.cleanup_jobs(kind, transaction_id, object_paths) VALUES ('photo_removed', p_id, removed); END IF;
  FOR p IN SELECT * FROM jsonb_array_elements(coalesce(p_photos,'[]'::jsonb)) LOOP
    INSERT INTO public.transaction_photos(id, owner_id, transaction_id, original_path, thumb_path, sort_order)
    VALUES ((p->>'id')::uuid, uid, p_id, p->>'original_path', p->>'thumb_path', coalesce((p->>'sort_order')::smallint,0))
    ON CONFLICT (id) DO UPDATE SET sort_order = EXCLUDED.sort_order WHERE transaction_photos.transaction_id = p_id AND transaction_photos.owner_id = uid;
  END LOOP;
  IF (SELECT count(*) FROM public.transaction_photos WHERE transaction_id = p_id) > 5 THEN RAISE EXCEPTION 'VALIDATION:Tối đa 5 ảnh mỗi giao dịch'; END IF;
  UPDATE public.transactions SET amount_vnd = p_amount, source_wallet_id = p_source, dest_wallet_id = p_dest, category_id = p_category,
    occurred_at = p_occurred_at, note = note_n, version = version + 1, updated_at = now() WHERE id = p_id;
  RETURN jsonb_build_object('status','updated','id',p_id,'version',t.version + 1);
END $$;

CREATE OR REPLACE FUNCTION public.trash_transaction(p_id uuid, p_version int) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); t record;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'AUTH:Chưa đăng nhập'; END IF;
  SELECT * INTO t FROM public.transactions WHERE id = p_id AND owner_id = uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'VALIDATION:Giao dịch không tồn tại'; END IF;
  IF t.version <> p_version OR t.deleted_at IS NOT NULL THEN RETURN jsonb_build_object('status','conflict','message','Giao dịch đã thay đổi. Hãy tải lại.'); END IF;
  UPDATE public.transactions SET deleted_at = now(), version = version + 1, updated_at = now() WHERE id = p_id;
  RETURN jsonb_build_object('status','trashed','id',p_id,'version',t.version + 1);
END $$;

CREATE OR REPLACE FUNCTION public.restore_transaction(p_id uuid, p_version int) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); t record;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'AUTH:Chưa đăng nhập'; END IF;
  SELECT * INTO t FROM public.transactions WHERE id = p_id AND owner_id = uid FOR UPDATE;
  IF NOT FOUND OR t.deleted_at IS NULL THEN RAISE EXCEPTION 'VALIDATION:Không tìm thấy trong thùng rác'; END IF;
  IF t.deleted_at <= now() - interval '30 days' THEN RAISE EXCEPTION 'VALIDATION:Đã quá hạn khôi phục 30 ngày'; END IF;
  IF t.version <> p_version THEN RETURN jsonb_build_object('status','conflict','message','Giao dịch đã thay đổi. Hãy tải lại.'); END IF;
  UPDATE public.transactions SET deleted_at = NULL, version = version + 1, updated_at = now() WHERE id = p_id;
  RETURN jsonb_build_object('status','restored','id',p_id,'version',t.version + 1);
END $$;

REVOKE ALL ON FUNCTION public.commit_transaction(uuid,text,bigint,uuid,uuid,uuid,timestamptz,text,jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_transaction(uuid,int,bigint,uuid,uuid,uuid,timestamptz,text,jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.trash_transaction(uuid,int) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.restore_transaction(uuid,int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.commit_transaction(uuid,text,bigint,uuid,uuid,uuid,timestamptz,text,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_transaction(uuid,int,bigint,uuid,uuid,uuid,timestamptz,text,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.trash_transaction(uuid,int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_transaction(uuid,int) TO authenticated;

-- ============ AGGREGATIONS (invoker; RLS applies) ============
CREATE OR REPLACE FUNCTION public.wallet_balances() RETURNS TABLE(wallet_id uuid, balance_vnd bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT w.id, w.opening_balance_vnd
    + coalesce((SELECT sum(t.amount_vnd) FROM public.transactions t WHERE t.dest_wallet_id = w.id AND t.deleted_at IS NULL AND t.type IN ('income','transfer')),0)::bigint
    - coalesce((SELECT sum(t.amount_vnd) FROM public.transactions t WHERE t.source_wallet_id = w.id AND t.deleted_at IS NULL AND t.type IN ('expense','transfer')),0)::bigint
  FROM public.wallets w WHERE w.owner_id = auth.uid();
$$;

-- month summary in Asia/Ho_Chi_Minh local month; optional wallet filter (for home cards, not budget)
CREATE OR REPLACE FUNCTION public.month_summary(p_month date, p_wallet uuid DEFAULT NULL)
RETURNS TABLE(expense_vnd bigint, income_vnd bigint, all_wallets_expense_vnd bigint, budget_vnd bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH b AS (SELECT (date_trunc('month', p_month)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh') s,
                    ((date_trunc('month', p_month) + interval '1 month')::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh') e),
  tx AS (SELECT t.* FROM public.transactions t, b WHERE t.owner_id = auth.uid() AND t.deleted_at IS NULL AND t.occurred_at >= b.s AND t.occurred_at < b.e)
  SELECT
    coalesce((SELECT sum(amount_vnd) FROM tx WHERE type='expense' AND (p_wallet IS NULL OR source_wallet_id = p_wallet)),0)::bigint,
    coalesce((SELECT sum(amount_vnd) FROM tx WHERE type='income' AND (p_wallet IS NULL OR dest_wallet_id = p_wallet)),0)::bigint,
    coalesce((SELECT sum(amount_vnd) FROM tx WHERE type='expense'),0)::bigint,
    (SELECT amount_vnd FROM public.monthly_budgets WHERE owner_id = auth.uid() AND month = date_trunc('month', p_month)::date);
$$;

CREATE OR REPLACE FUNCTION public.month_category_expense(p_month date)
RETURNS TABLE(category_id uuid, total_vnd bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT coalesce(c.parent_id, c.id), sum(t.amount_vnd)::bigint
  FROM public.transactions t JOIN public.categories c ON c.id = t.category_id
  WHERE t.owner_id = auth.uid() AND t.deleted_at IS NULL AND t.type = 'expense'
    AND t.occurred_at >= (date_trunc('month', p_month)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')
    AND t.occurred_at < ((date_trunc('month', p_month) + interval '1 month')::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')
  GROUP BY 1 ORDER BY 2 DESC;
$$;

CREATE OR REPLACE FUNCTION public.month_daily(p_month date)
RETURNS TABLE(day date, expense_vnd bigint, income_vnd bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT (t.occurred_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date,
    coalesce(sum(t.amount_vnd) FILTER (WHERE t.type='expense'),0)::bigint,
    coalesce(sum(t.amount_vnd) FILTER (WHERE t.type='income'),0)::bigint
  FROM public.transactions t
  WHERE t.owner_id = auth.uid() AND t.deleted_at IS NULL AND t.type IN ('expense','income')
    AND t.occurred_at >= (date_trunc('month', p_month)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')
    AND t.occurred_at < ((date_trunc('month', p_month) + interval '1 month')::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')
  GROUP BY 1 ORDER BY 1;
$$;
GRANT EXECUTE ON FUNCTION public.wallet_balances() TO authenticated;
GRANT EXECUTE ON FUNCTION public.month_summary(date, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.month_category_expense(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.month_daily(date) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.wallet_balances() FROM anon;
REVOKE EXECUTE ON FUNCTION public.month_summary(date, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.month_category_expense(date) FROM anon;
REVOKE EXECUTE ON FUNCTION public.month_daily(date) FROM anon;

-- ============ PURGE (service role only) ============
CREATE OR REPLACE FUNCTION public.claim_expired_trash(p_limit int DEFAULT 100) RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; n int := 0; paths text[];
BEGIN
  FOR r IN SELECT id FROM public.transactions WHERE deleted_at IS NOT NULL AND deleted_at <= now() - interval '30 days'
           ORDER BY deleted_at LIMIT p_limit FOR UPDATE SKIP LOCKED LOOP
    SELECT coalesce(array_agg(x),'{}') INTO paths FROM (SELECT unnest(ARRAY[original_path, thumb_path]) x FROM public.transaction_photos WHERE transaction_id = r.id) s;
    INSERT INTO public.cleanup_jobs(kind, transaction_id, object_paths) VALUES ('purge', r.id, paths);
    DELETE FROM public.transactions WHERE id = r.id;
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;

CREATE OR REPLACE FUNCTION public.find_orphan_objects(p_limit int DEFAULT 200) RETURNS TABLE(name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, storage AS $$
  SELECT o.name FROM storage.objects o
  WHERE o.bucket_id = 'photos' AND o.created_at < now() - interval '1 day'
    AND split_part(o.name,'/',2) <> 'avatar'
    AND NOT EXISTS (SELECT 1 FROM public.transaction_photos p WHERE p.original_path = o.name OR p.thumb_path = o.name)
  LIMIT p_limit;
$$;
REVOKE ALL ON FUNCTION public.claim_expired_trash(int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.find_orphan_objects(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_expired_trash(int) TO service_role;
GRANT EXECUTE ON FUNCTION public.find_orphan_objects(int) TO service_role;

-- ============ REALTIME ============
ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions, public.wallets, public.categories, public.monthly_budgets, public.profiles;
