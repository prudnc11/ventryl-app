-- ============================================================================
-- Ventryl P16 — Performance indexes for production scale
-- Run this in Supabase SQL Editor
-- ============================================================================

-- Orders table — most queried table
CREATE INDEX IF NOT EXISTS idx_orders_buyer_id ON orders (buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_depot_id ON orders (depot_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_placed_at ON orders (placed_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_buyer_status ON orders (buyer_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_depot_status ON orders (depot_id, status);

-- Order items — joined on every order query
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items (order_id);

-- Order trucks — joined on order detail
CREATE INDEX IF NOT EXISTS idx_order_trucks_order_id ON order_trucks (order_id);

-- Order status logs — timeline queries
CREATE INDEX IF NOT EXISTS idx_order_status_logs_order_id ON order_status_logs (order_id);
CREATE INDEX IF NOT EXISTS idx_order_status_logs_created ON order_status_logs (order_id, created_at);

-- Delivery negotiations
CREATE INDEX IF NOT EXISTS idx_delivery_negotiations_order_id ON delivery_negotiations (order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_rounds_negotiation_id ON delivery_rounds (negotiation_id);

-- Transactions — wallet history
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions (user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_created ON transactions (user_id, created_at DESC);

-- Wallets
CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets (user_id);

-- Profiles
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles (email);
CREATE INDEX IF NOT EXISTS idx_profiles_kyc_status ON profiles (kyc_status);

-- Depots
CREATE INDEX IF NOT EXISTS idx_depots_owner_id ON depots (owner_id);
CREATE INDEX IF NOT EXISTS idx_depots_kyb ON depots (kyb);

-- Depot products
CREATE INDEX IF NOT EXISTS idx_depot_products_depot_id ON depot_products (depot_id);

-- KYC/KYB documents
CREATE INDEX IF NOT EXISTS idx_kyc_documents_user_id ON kyc_documents (user_id);
CREATE INDEX IF NOT EXISTS idx_kyb_documents_depot_id ON kyb_documents (depot_id);

-- Notifications
CREATE INDEX IF NOT EXISTS idx_notification_log_user ON notification_log (user_id, created_at DESC);

-- Price history
CREATE INDEX IF NOT EXISTS idx_price_history_product ON price_history (product, recorded_at DESC);

-- Disputes
CREATE INDEX IF NOT EXISTS idx_disputes_order_id ON disputes (order_id);

-- Platform settings log
CREATE INDEX IF NOT EXISTS idx_platform_settings_log_key ON platform_settings_log (key, changed_at DESC);
