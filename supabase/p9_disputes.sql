-- ════════════════════════════════════════════════════════════════════
-- Ventryl P9 — Disputes table
-- Run AFTER p8_order_seq.sql
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS disputes (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  reference    TEXT        NOT NULL UNIQUE,
  order_id     TEXT        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  buyer_id     UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  reason       TEXT        NOT NULL,
  details      TEXT        NOT NULL,
  status       TEXT        NOT NULL DEFAULT 'open'
                             CHECK (status IN ('open','under_review','resolved','closed')),
  admin_note   TEXT,
  resolved_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;

-- Buyer can view & file their own disputes
CREATE POLICY "disputes_buyer_select"
  ON disputes FOR SELECT USING (buyer_id = auth.uid());

CREATE POLICY "disputes_buyer_insert"
  ON disputes FOR INSERT WITH CHECK (buyer_id = auth.uid());

-- Depot owner can view disputes on their orders
CREATE POLICY "disputes_depot_select"
  ON disputes FOR SELECT
  USING (
    order_id IN (
      SELECT id FROM orders
      WHERE depot_id IN (SELECT id FROM depots WHERE owner_id = auth.uid())
    )
  );
