-- ════════════════════════════════════════════════════════════════════
-- Ventryl P4 — Depot Operations Contact fields + signup trigger
-- Run AFTER p3_vcs.sql
-- ════════════════════════════════════════════════════════════════════

-- ── 1. Add operations contact columns to depots ─────────────────────
ALTER TABLE depots
  ADD COLUMN IF NOT EXISTS contact_name   TEXT,
  ADD COLUMN IF NOT EXISTS contact_phone  TEXT,
  ADD COLUMN IF NOT EXISTS contact_email  TEXT,
  ADD COLUMN IF NOT EXISTS contact_role   TEXT;

-- ── 2. Auto-create profile row on new user signup ───────────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, company_name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'company_name', ''),
    NEW.raw_user_meta_data->>'phone'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ── 3. Backfill profiles for any existing users missing a profile ───
INSERT INTO public.profiles (id, full_name, company_name, phone)
SELECT
  u.id,
  COALESCE(u.raw_user_meta_data->>'full_name', u.email, ''),
  COALESCE(u.raw_user_meta_data->>'company_name', ''),
  u.raw_user_meta_data->>'phone'
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id)
ON CONFLICT (id) DO NOTHING;

-- ── 4. Patch existing profiles that have empty full_name/phone ───────
-- (Fills in data from signup metadata for accounts created before the trigger)
UPDATE public.profiles p
SET
  full_name   = COALESCE(NULLIF(p.full_name,''),   u.raw_user_meta_data->>'full_name', u.email, ''),
  company_name= COALESCE(NULLIF(p.company_name,''),u.raw_user_meta_data->>'company_name', ''),
  phone       = COALESCE(p.phone,                  u.raw_user_meta_data->>'phone')
FROM auth.users u
WHERE p.id = u.id
  AND (p.full_name = '' OR p.phone IS NULL);
