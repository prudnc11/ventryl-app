-- p21: Company & Location Verification
-- Adds Company entity (parent of depots) and location type / verification fields

-- 1. Companies table
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES profiles(id) NOT NULL,
  name TEXT NOT NULL,
  logo_url TEXT,
  website TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. New columns on depots table
ALTER TABLE depots
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id),
  ADD COLUMN IF NOT EXISTS location_type TEXT DEFAULT 'depot',
  ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS lease_agreement_url TEXT,
  ADD COLUMN IF NOT EXISTS lease_expiry DATE;

-- Add check constraints (idempotent)
DO $$ BEGIN
  ALTER TABLE depots ADD CONSTRAINT depots_location_type_check
    CHECK (location_type IN ('depot', 'stock_point'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE depots ADD CONSTRAINT depots_verification_status_check
    CHECK (verification_status IN ('active', 'expired', 'pending'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. RLS policies for companies
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can read companies" ON companies
    FOR SELECT USING (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can insert own company" ON companies
    FOR INSERT WITH CHECK (auth.uid() = owner_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update own company" ON companies
    FOR UPDATE USING (auth.uid() = owner_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4. Extend kyb_documents type check to allow lease_agreement
ALTER TABLE kyb_documents DROP CONSTRAINT IF EXISTS kyb_documents_type_check;
ALTER TABLE kyb_documents ADD CONSTRAINT kyb_documents_type_check
  CHECK (type = ANY (ARRAY[
    'nmdpra_license','cac_cert','tax_clearance','env_permit',
    'proof_of_address','director_id','tank_calibration','lease_agreement'
  ]));

-- 5. Storage bucket for company logos (idempotent)
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-logos', 'company-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Public read access for company logos
DO $$ BEGIN
  CREATE POLICY "Public read company logos" ON storage.objects
    FOR SELECT USING (bucket_id = 'company-logos');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Authenticated users can upload company logos
DO $$ BEGIN
  CREATE POLICY "Auth users upload company logos" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'company-logos' AND auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Auth users update company logos" ON storage.objects
    FOR UPDATE USING (bucket_id = 'company-logos' AND auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
