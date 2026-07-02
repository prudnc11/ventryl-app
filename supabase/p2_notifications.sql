-- ════════════════════════════════════════════════════════════════════
-- Ventryl P2 — Notifications Schema
-- Run AFTER p1_schema.sql
-- Adds: notif_prefs on profiles, notification_log table, DB webhook helper
-- ════════════════════════════════════════════════════════════════════

-- ── 1. Notification preferences column on profiles ────────────────────
-- Stored as JSONB so adding new pref keys requires no migration.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS notif_prefs JSONB NOT NULL DEFAULT '{
    "orderUpdates": true,
    "slaWarnings":  true,
    "deliveryConfirm": true,
    "priceAlerts": false,
    "weeklyReport": false,
    "emailCh": true,
    "smsCh":   false,
    "pushCh":  false
  }';

-- ── 2. Notification log ────────────────────────────────────────────────
-- Records every notification dispatched so users can see their history.
CREATE TABLE IF NOT EXISTS notification_log (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type       TEXT        NOT NULL,
  channel    TEXT        NOT NULL CHECK (channel IN ('email','sms','both','push')),
  ref_id     UUID,                -- e.g. order id that triggered this
  subject    TEXT,
  body       TEXT,
  status     TEXT        NOT NULL DEFAULT 'sent'
               CHECK (status IN ('sent','failed','skipped')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notif_log:own:select" ON notification_log;
CREATE POLICY "notif_log:own:select"
  ON notification_log FOR SELECT
  USING (auth.uid() = user_id);

-- Admins insert via service role key (Edge Function), no insert RLS needed for users.

-- Index for user notification history
CREATE INDEX IF NOT EXISTS notif_log_user_created_idx
  ON notification_log (user_id, created_at DESC);

-- ── 3. Helper: call send-notification Edge Function on order status change ──
-- Uses pg_net (enable in Supabase Dashboard → Extensions → pg_net).
-- This trigger fires after every order UPDATE and dispatches notifications
-- to both buyer and depot if their preferences allow.
--
-- IMPORTANT: Replace 'https://YOUR_PROJECT_REF.supabase.co' with your actual URL.
--            Replace 'YOUR_ANON_KEY' with your service_role key in production.
--            Or use Supabase Database Webhooks (Dashboard → Database → Webhooks)
--            instead of pg_net for simpler setup.

-- Uncomment and configure if pg_net extension is enabled:
/*
CREATE OR REPLACE FUNCTION notify_order_status_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  buyer_profile RECORD;
  depot_owner   RECORD;
  event_type    TEXT;
BEGIN
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;

  -- Resolve buyer
  SELECT p.id, p.full_name, p.email, p.phone, p.notif_prefs
    INTO buyer_profile
    FROM profiles p WHERE p.id = NEW.buyer_id;

  -- Resolve depot owner
  SELECT p.id, p.full_name, p.email, p.phone, p.notif_prefs
    INTO depot_owner
    FROM profiles p
    JOIN depots d ON d.owner_id = p.id
    WHERE d.id = NEW.depot_id;

  -- Map status to event type
  event_type := CASE NEW.status
    WHEN 'confirmed'  THEN 'order_confirmed'
    WHEN 'in_transit' THEN 'order_dispatched'
    WHEN 'delivered'  THEN 'order_delivered'
    ELSE NULL
  END;

  IF event_type IS NULL THEN RETURN NEW; END IF;

  -- Notify buyer (email)
  IF (buyer_profile.notif_prefs->>'emailCh')::boolean = true
     AND (buyer_profile.notif_prefs->>'orderUpdates')::boolean = true
     AND buyer_profile.email IS NOT NULL THEN
    PERFORM net.http_post(
      url     := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-notification',
      headers := '{"Content-Type":"application/json","Authorization":"Bearer YOUR_SERVICE_ROLE_KEY"}',
      body    := json_build_object(
        'user_id', buyer_profile.id,
        'type',    event_type,
        'channel', 'email',
        'to_email', buyer_profile.email,
        'data', json_build_object(
          'orderId', NEW.id,
          'buyerName', buyer_profile.full_name,
          'product', (SELECT product FROM order_items WHERE order_id=NEW.id LIMIT 1),
          'vol', NEW.vol_litres,
          'depotName', (SELECT name FROM depots WHERE id=NEW.depot_id)
        )
      )::text
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS order_status_notify ON orders;
CREATE TRIGGER order_status_notify
  AFTER UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION notify_order_status_change();
*/

-- ── 4. Alternative: Supabase Database Webhook (no pg_net needed) ──────────────
-- Go to Supabase Dashboard → Database → Webhooks → Create Webhook
--   Name: order_status_notification
--   Table: orders
--   Events: UPDATE
--   URL: https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-notification
--   HTTP Method: POST
--   Headers: Authorization: Bearer YOUR_SERVICE_ROLE_KEY
--
-- The Edge Function will receive the full postgres changes payload and
-- can read NEW.status and OLD.status to determine what notification to send.
