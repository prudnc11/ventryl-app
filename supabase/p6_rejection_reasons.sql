-- ════════════════════════════════════════════════════════════════════
-- Ventryl P6 — Rejection reason columns for KYB and KYC
-- Run AFTER p5_fixes.sql
-- ════════════════════════════════════════════════════════════════════

-- ── 1. KYB rejection reason on depots ────────────────────────────
ALTER TABLE depots ADD COLUMN IF NOT EXISTS kyb_rejection_reason TEXT;

-- ── 2. KYC rejection reason on profiles ──────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS kyc_rejection_reason TEXT;
