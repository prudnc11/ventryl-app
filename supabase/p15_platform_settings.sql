-- ============================================================================
-- Ventryl P15 — Platform Settings table (fees, rates, config)
-- ============================================================================

CREATE TABLE IF NOT EXISTS platform_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Seed default platform fee (1%)
INSERT INTO platform_settings (key, value)
VALUES ('platform_fee_percent', '1')
ON CONFLICT (key) DO NOTHING;

-- Audit log for sensitive config changes
CREATE TABLE IF NOT EXISTS platform_settings_log (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key        TEXT NOT NULL,
  old_value  TEXT,
  new_value  TEXT NOT NULL,
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ DEFAULT now(),
  method     TEXT DEFAULT 'admin'  -- 'admin', 'system'
);

-- RLS: only admins can read/write platform_settings
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_settings_log ENABLE ROW LEVEL SECURITY;

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

CREATE POLICY "Admins can read settings log" ON platform_settings_log
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Admins can insert settings log" ON platform_settings_log
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Public read for platform_fee_percent (needed by orders.create)
CREATE POLICY "Anyone can read fee percent" ON platform_settings
  FOR SELECT USING (key = 'platform_fee_percent');

-- Function to get platform fee (callable from client without admin)
CREATE OR REPLACE FUNCTION get_platform_fee_percent()
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(value::numeric, 1) FROM platform_settings WHERE key = 'platform_fee_percent';
$$;
