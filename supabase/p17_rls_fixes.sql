-- ============================================================================
-- Ventryl P17 — RLS Policy Fixes
-- Run this in Supabase SQL Editor
-- ============================================================================

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ FIX 1: platform_settings — admin policies use role='admin' but         │
-- │        profiles table has is_admin boolean. Drop + recreate.           │
-- └──────────────────────────────────────────────────────────────────────────┘

DROP POLICY IF EXISTS "Admins can read settings" ON platform_settings;
DROP POLICY IF EXISTS "Admins can update settings" ON platform_settings;
DROP POLICY IF EXISTS "Admins can insert settings" ON platform_settings;

CREATE POLICY "Admins can read settings" ON platform_settings
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Admins can update settings" ON platform_settings
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Admins can insert settings" ON platform_settings
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ FIX 2: platform_settings_log — same broken admin check                 │
-- └──────────────────────────────────────────────────────────────────────────┘

DROP POLICY IF EXISTS "Admins can read settings log" ON platform_settings_log;
DROP POLICY IF EXISTS "Admins can insert settings log" ON platform_settings_log;

CREATE POLICY "Admins can read settings log" ON platform_settings_log
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Admins can insert settings log" ON platform_settings_log
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ FIX 3: dispute-evidence storage — too permissive, any authenticated    │
-- │        user can read/upload all evidence. Restrict to dispute parties. │
-- └──────────────────────────────────────────────────────────────────────────┘

DROP POLICY IF EXISTS "dispute_evidence_upload" ON storage.objects;
DROP POLICY IF EXISTS "dispute_evidence_read" ON storage.objects;

-- Upload: only the dispute's buyer can upload (files stored as {order_id}/{filename})
-- The order_id is the first folder segment — verify user is buyer of that order
CREATE POLICY "dispute_evidence_upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'dispute-evidence'
    AND auth.role() = 'authenticated'
    AND (
      -- Buyer of the order (folder = order_id)
      EXISTS (
        SELECT 1 FROM orders
        WHERE id::text = (storage.foldername(name))[1]
        AND buyer_id = auth.uid()
      )
      -- Or depot owner of the order
      OR EXISTS (
        SELECT 1 FROM orders
        WHERE id::text = (storage.foldername(name))[1]
        AND depot_id IN (SELECT id FROM depots WHERE owner_id = auth.uid())
      )
      -- Or admin
      OR EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true
      )
    )
  );

-- Read: only dispute parties (buyer, depot owner) and admins
CREATE POLICY "dispute_evidence_read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'dispute-evidence'
    AND (
      -- Buyer of the order
      EXISTS (
        SELECT 1 FROM orders
        WHERE id::text = (storage.foldername(name))[1]
        AND buyer_id = auth.uid()
      )
      -- Or depot owner of the order
      OR EXISTS (
        SELECT 1 FROM orders
        WHERE id::text = (storage.foldername(name))[1]
        AND depot_id IN (SELECT id FROM depots WHERE owner_id = auth.uid())
      )
      -- Or admin
      OR EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true
      )
    )
  );
