-- ════════════════════════════════════════════════════════════════════
-- Ventryl P5 — Missing profile columns + email sync trigger
-- Run AFTER schema.sql and p1_schema.sql
-- ════════════════════════════════════════════════════════════════════

-- ── 1. Add missing profile columns ───────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email        TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notif_prefs  JSONB;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS address      TEXT;

-- ── 2. Backfill email from auth.users ────────────────────────────────
UPDATE profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id;

-- ── 3. Trigger: keep profiles.email in sync with auth.users.email ────
CREATE OR REPLACE FUNCTION sync_profile_email()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    UPDATE public.profiles SET email = NEW.email WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_email_updated ON auth.users;
CREATE TRIGGER on_auth_email_updated
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW EXECUTE FUNCTION sync_profile_email();

-- ── 4. Also set email on new user signup ─────────────────────────────
-- (patch the existing handle_new_user function to include email)
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, company_name, phone, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'company_name', ''),
    NEW.raw_user_meta_data->>'phone',
    NEW.email
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
