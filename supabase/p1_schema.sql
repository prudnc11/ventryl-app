-- ════════════════════════════════════════════════════════════════════
-- Ventryl P1 Schema — run AFTER schema.sql
-- Adds: KYC docs, KYB docs, order state machine, storage buckets
-- ════════════════════════════════════════════════════════════════════

-- ── KYC Documents (individual / company verification) ────────────────
-- One row per document type per user.
-- kyc_status on the profiles row moves to 'submitted' when the user
-- submits; to 'verified' or 'rejected' when an admin reviews.
CREATE TABLE IF NOT EXISTS kyc_documents (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type             TEXT        NOT NULL
                     CHECK (type IN ('nin','passport','drivers_license','cac_cert','proof_of_address')),
  file_path        TEXT        NOT NULL,   -- path inside kyc-documents bucket
  file_name        TEXT        NOT NULL,
  file_size        INTEGER,
  status           TEXT        NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','approved','rejected')),
  rejection_reason TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, type)
);

ALTER TABLE kyc_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "kyc_docs:own:all" ON kyc_documents;
CREATE POLICY "kyc_docs:own:all"
  ON kyc_documents FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── KYB Documents (depot-level verification) ─────────────────────────
-- One row per document type per depot.
-- depot.kyb_status moves to 'submitted' when the owner submits;
-- 'verified' or 'rejected' when an admin reviews.
CREATE TABLE IF NOT EXISTS kyb_documents (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  depot_id         UUID        NOT NULL REFERENCES depots(id) ON DELETE CASCADE,
  type             TEXT        NOT NULL
                     CHECK (type IN (
                       'nmdpra_license','cac_cert','tax_clearance',
                       'env_permit','proof_of_address','director_id','tank_calibration'
                     )),
  file_path        TEXT        NOT NULL,   -- path inside kyb-documents bucket
  file_name        TEXT        NOT NULL,
  file_size        INTEGER,
  status           TEXT        NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','approved','rejected')),
  rejection_reason TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (depot_id, type)
);

ALTER TABLE kyb_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "kyb_docs:owner:all" ON kyb_documents;
CREATE POLICY "kyb_docs:owner:all"
  ON kyb_documents FOR ALL
  USING  (depot_id IN (SELECT id FROM depots WHERE owner_id = auth.uid()))
  WITH CHECK (depot_id IN (SELECT id FROM depots WHERE owner_id = auth.uid()));

-- ── Order State Machine ───────────────────────────────────────────────
-- Valid transitions:
--   pending    → confirmed | rejected | cancelled
--   confirmed  → loading   | cancelled
--   loading    → in_transit
--   in_transit → delivered | collected | disputed
--   delivered  → disputed
--   collected  → (terminal)
--   disputed   → delivered | collected
--   rejected   → (terminal)
--   cancelled  → (terminal)

CREATE OR REPLACE FUNCTION validate_order_transition(
  current_status TEXT,
  new_status     TEXT
) RETURNS BOOLEAN LANGUAGE plpgsql STABLE AS $$
DECLARE
  allowed JSONB := '{
    "pending":    ["confirmed","rejected","cancelled"],
    "confirmed":  ["loading","cancelled"],
    "loading":    ["in_transit"],
    "in_transit": ["delivered","collected","disputed"],
    "delivered":  ["disputed"],
    "collected":  [],
    "disputed":   ["delivered","collected"],
    "rejected":   [],
    "cancelled":  []
  }';
BEGIN
  -- Same status → no-op, always allowed
  IF current_status = new_status THEN RETURN TRUE; END IF;
  RETURN (allowed->current_status) @> to_jsonb(new_status);
END;
$$;

CREATE OR REPLACE FUNCTION enforce_order_state_machine()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    IF NOT validate_order_transition(OLD.status, NEW.status) THEN
      RAISE EXCEPTION
        'Invalid order status transition: % → %. Allowed from %: %',
        OLD.status, NEW.status, OLD.status,
        (SELECT jsonb_agg(x) FROM jsonb_array_elements_text(
          ('{"pending":["confirmed","rejected","cancelled"],"confirmed":["loading","cancelled"],"loading":["in_transit"],"in_transit":["delivered","collected","disputed"],"delivered":["disputed"],"collected":[],"disputed":["delivered","collected"],"rejected":[],"cancelled":[]}')
          ->OLD.status
        ) x)
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS order_state_machine ON orders;
CREATE TRIGGER order_state_machine
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION enforce_order_state_machine();

-- ── Supabase Storage Buckets ──────────────────────────────────────────
-- Creates private buckets for KYC and KYB document storage.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('kyc-documents', 'kyc-documents', false, 10485760,  -- 10 MB
   ARRAY['application/pdf','image/jpeg','image/png','image/webp']),
  ('kyb-documents', 'kyb-documents', false, 10485760,
   ARRAY['application/pdf','image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: users can only access files under their own uid/ prefix
DROP POLICY IF EXISTS "kyc_storage:own:insert" ON storage.objects;
DROP POLICY IF EXISTS "kyc_storage:own:select" ON storage.objects;
DROP POLICY IF EXISTS "kyb_storage:own:insert" ON storage.objects;
DROP POLICY IF EXISTS "kyb_storage:own:select" ON storage.objects;

CREATE POLICY "kyc_storage:own:insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'kyc-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "kyc_storage:own:select"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'kyc-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "kyb_storage:own:insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'kyb-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "kyb_storage:own:select"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'kyb-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
