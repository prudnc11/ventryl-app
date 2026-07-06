-- ════════════════════════════════════════════════════════════════════
-- Ventryl P10 — Add evidence_urls to disputes + create storage bucket
-- Run in Supabase Dashboard → SQL Editor
-- ════════════════════════════════════════════════════════════════════

-- Add evidence URLs column to disputes
ALTER TABLE disputes ADD COLUMN IF NOT EXISTS evidence_urls TEXT[] DEFAULT '{}';

-- Create dispute-evidence storage bucket (public read so depot/admin can view)
INSERT INTO storage.buckets (id, name, public)
VALUES ('dispute-evidence', 'dispute-evidence', true)
ON CONFLICT (id) DO NOTHING;

-- Upload: only dispute parties (buyer, depot owner) and admins
CREATE POLICY "dispute_evidence_upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'dispute-evidence'
    AND auth.role() = 'authenticated'
    AND (
      EXISTS (
        SELECT 1 FROM orders
        WHERE id::text = (storage.foldername(name))[1]
        AND buyer_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM orders
        WHERE id::text = (storage.foldername(name))[1]
        AND depot_id IN (SELECT id FROM depots WHERE owner_id = auth.uid())
      )
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
      EXISTS (
        SELECT 1 FROM orders
        WHERE id::text = (storage.foldername(name))[1]
        AND buyer_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM orders
        WHERE id::text = (storage.foldername(name))[1]
        AND depot_id IN (SELECT id FROM depots WHERE owner_id = auth.uid())
      )
      OR EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true
      )
    )
  );
