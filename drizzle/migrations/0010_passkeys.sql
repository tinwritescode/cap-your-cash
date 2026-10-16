CREATE TABLE public.passkeys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  credential_id text NOT NULL UNIQUE,
  public_key text NOT NULL,
  counter bigint NOT NULL DEFAULT 0,
  transports text[] NOT NULL DEFAULT '{}',
  device_name text NOT NULL DEFAULT 'Passkey',
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);
CREATE INDEX passkeys_user_idx ON public.passkeys(user_id);
GRANT SELECT ON public.passkeys TO authenticated;
GRANT ALL ON public.passkeys TO service_role;
ALTER TABLE public.passkeys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own passkeys read" ON public.passkeys FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.passkey_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  challenge text NOT NULL,
  purpose text NOT NULL CHECK (purpose IN ('register','login')),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '5 minutes',
  used_at timestamptz
);
GRANT ALL ON public.passkey_challenges TO service_role;
ALTER TABLE public.passkey_challenges ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.passkey_delete(p_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH: not signed in'; END IF;
  DELETE FROM public.passkeys WHERE id = p_id AND user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND: passkey'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.passkey_delete(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.passkey_delete(uuid) TO authenticated;