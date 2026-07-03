-- ════════════════════════════════════════════════════════════════════
-- Ventryl P7 — Depot team members & invites
-- Run AFTER p6_rejection_reasons.sql
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS depot_members (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  depot_id     UUID        NOT NULL REFERENCES depots(id) ON DELETE CASCADE,
  user_id      UUID        REFERENCES profiles(id) ON DELETE SET NULL,  -- null until invite accepted
  email        TEXT        NOT NULL,
  name         TEXT        NOT NULL DEFAULT '',
  role         TEXT        NOT NULL DEFAULT 'staff'
                             CHECK (role IN ('admin','manager','supervisor','staff','viewer')),
  status       TEXT        NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('active','inactive','pending')),
  invited_by   UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  joined_at    TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (depot_id, email)
);

-- ── RLS ─────────────────────────────────────────────────────────────
ALTER TABLE depot_members ENABLE ROW LEVEL SECURITY;

-- Depot owner can read all members of their depots
CREATE POLICY "depot_members_select"
  ON depot_members FOR SELECT
  USING (
    depot_id IN (SELECT id FROM depots WHERE owner_id = auth.uid())
    OR user_id = auth.uid()
  );

-- Depot owner can insert/update/delete members of their depots
CREATE POLICY "depot_members_write"
  ON depot_members FOR ALL
  USING (depot_id IN (SELECT id FROM depots WHERE owner_id = auth.uid()));
