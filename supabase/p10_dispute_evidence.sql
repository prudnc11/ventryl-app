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

-- Allow authenticated users to upload to their own dispute folder
CREATE POLICY "dispute_evidence_upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'dispute-evidence'
    AND auth.role() = 'authenticated'
  );

-- Allow authenticated users to read evidence files
CREATE POLICY "dispute_evidence_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'dispute-evidence' AND auth.role() = 'authenticated');
