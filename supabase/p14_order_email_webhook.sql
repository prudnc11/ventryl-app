-- ============================================================================
-- Ventryl P14 — Database webhook trigger for order email notifications
-- Run AFTER deploying the order-status-webhook Edge Function
-- ============================================================================

-- Enable the pg_net extension (required for Supabase HTTP webhooks)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ── Trigger function ────────────────────────────────────────────────────────
-- Sends the old + new row to the Edge Function on every status change
CREATE OR REPLACE FUNCTION notify_order_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  payload jsonb;
  func_url text;
  service_key text;
BEGIN
  -- Build the webhook payload matching Supabase webhook format
  payload := jsonb_build_object(
    'type', TG_OP,
    'table', TG_TABLE_NAME,
    'schema', TG_TABLE_SCHEMA,
    'record', row_to_json(NEW),
    'old_record', CASE WHEN TG_OP = 'UPDATE' THEN row_to_json(OLD) ELSE NULL END
  );

  -- Get the Edge Function URL from vault or hardcode your project ref
  -- Replace YOUR_PROJECT_REF with your actual Supabase project ref
  func_url := 'https://' || current_setting('app.settings.supabase_url', true)
    || '/functions/v1/order-status-webhook';

  -- Fallback: if app.settings not available, use direct URL
  IF func_url IS NULL OR func_url = 'https:///functions/v1/order-status-webhook' THEN
    -- You'll replace this with your actual project URL after deployment
    func_url := 'https://jjrtkgpqnasxanbkucho.supabase.co/functions/v1/order-status-webhook';
  END IF;

  -- Use pg_net to make async HTTP call (non-blocking)
  PERFORM net.http_post(
    url := func_url,
    body := payload,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    )
  );

  RETURN NEW;
END;
$$;

-- ── Trigger on INSERT (new orders) ──────────────────────────────────────────
DROP TRIGGER IF EXISTS order_email_on_insert ON orders;
CREATE TRIGGER order_email_on_insert
  AFTER INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION notify_order_status_change();

-- ── Trigger on UPDATE (status changes only) ─────────────────────────────────
DROP TRIGGER IF EXISTS order_email_on_status_change ON orders;
CREATE TRIGGER order_email_on_status_change
  AFTER UPDATE ON orders
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION notify_order_status_change();
