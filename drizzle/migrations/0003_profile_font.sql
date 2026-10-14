ALTER TABLE public.profiles ADD COLUMN font text NOT NULL DEFAULT 'jakarta';
ALTER TABLE public.profiles ADD CONSTRAINT profiles_font_check CHECK (font ~ '^[a-z0-9-]{1,32}$');