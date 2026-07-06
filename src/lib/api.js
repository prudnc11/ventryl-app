/**
 * Ventryl API Service Layer
 * All data operations go through this module. Abstracts Supabase calls.
 */
import { supabase } from './supabase';
import { compressImage } from './imageCompress';

// ── Helpers ──────────────────────────────────────────────────────────────────

function assertOk(error, context) {
  if (!error) return;
  const msg = error.message
    || error.error_description
    || error.msg
    || (typeof error === 'string' ? error : JSON.stringify(error));
  console.error(`[${context}]`, error);
  throw new Error(msg);
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export const auth = {
  /** Sign up a new user and create their profile */
  async signUp({ email, password, fullName, companyName, phone, state, lga }) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, company_name: companyName, phone, state, lga },
      },
    });
    assertOk(error, 'auth.signUp');
    // Supabase returns user: null when the email is already registered
    // (it silently "succeeds" to prevent email enumeration)
    if (!data?.user) {
      throw new Error('This email is already registered. Try signing in instead.');
    }
    return data;
  },

  /** Sign in with email and password */
  async signIn({ email, password }) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    assertOk(error, 'auth.signIn');
    return data;
  },

  /** Sign out the current user */
  async signOut() {
    const { error } = await supabase.auth.signOut();
    assertOk(error, 'auth.signOut');
  },

  /** Send a password reset email */
  async resetPassword(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    assertOk(error, 'auth.resetPassword');
  },

  /** Get the current session */
  async getSession() {
    const { data, error } = await supabase.auth.getSession();
    assertOk(error, 'auth.getSession');
    return data.session;
  },

  /** Subscribe to auth state changes */
  onAuthChange(callback) {
    return supabase.auth.onAuthStateChange(callback);
  },
};

// ── Profiles ─────────────────────────────────────────────────────────────────

export const profiles = {
  async get(userId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    assertOk(error, 'profiles.get');
    return data;
  },

  async update(userId, patch) {
    const { data, error } = await supabase
      .from('profiles')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select()
      .single();
    assertOk(error, 'profiles.update');
    return data;
  },
};

// ── Depots ───────────────────────────────────────────────────────────────────

export const depots = {
  /** Get all active verified depots for the marketplace */
  async list() {
    const { data, error } = await supabase
      .from('depots')
      .select(`
        *,
        depot_products (product, price_per_litre, stock, threshold, is_active)
      `)
      .eq('is_active', true)
      .eq('kyb_status', 'verified')
      .order('rating', { ascending: false });
    assertOk(error, 'depots.list');
    return data;
  },

  /** Get all depots owned by a specific user */
  async listByOwner(ownerId) {
    const { data, error } = await supabase
      .from('depots')
      .select(`
        *,
        depot_products (id, product, price_per_litre, stock, threshold, is_active),
        stock_history (id, product, quantity, type, reference, created_at)
      `)
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false });
    assertOk(error, 'depots.listByOwner');
    return data;
  },

  /** Get a single depot by ID (includes products + recent stock history) */
  async get(depotId) {
    const { data, error } = await supabase
      .from('depots')
      .select(`
        *,
        depot_products (id, product, price_per_litre, stock, threshold, is_active),
        stock_history (id, product, quantity, type, reference, created_at)
      `)
      .eq('id', depotId)
      .single();
    assertOk(error, 'depots.get');
    return data;
  },

  /**
   * Create a new depot. Caller must have kyc_status = 'verified' on their
   * profile before invoking — the depot itself starts with kyb_status = 'pending'.
   */
  async create({ ownerId, name, location, state, lga, address, licenseNumber, licenseExpiry, capacity, products, vatPercent, contactName, contactPhone, contactEmail, contactRole }) {
    const { data: depot, error: depotErr } = await supabase
      .from('depots')
      .insert({
        owner_id: ownerId,
        name,
        location,
        state,
        lga,
        address,
        license_number: licenseNumber,
        license_expiry: licenseExpiry || null,
        capacity: capacity ? Number(capacity) : 0,
        vat_percent: vatPercent ?? 7.5,
        contact_name: contactName || null,
        contact_phone: contactPhone || null,
        contact_email: contactEmail || null,
        kyb_status: 'pending',
      })
      .select()
      .single();
    assertOk(depotErr, 'depots.create');

    return depot;
  },

  /** Update depot metadata */
  async update(depotId, patch) {
    const { data, error } = await supabase
      .from('depots')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', depotId)
      .select()
      .single();
    assertOk(error, 'depots.update');
    return data;
  },

  /** Update a product's price or threshold */
  async updateProduct(depotId, product, patch) {
    const { data, error } = await supabase
      .from('depot_products')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('depot_id', depotId)
      .eq('product', product)
      .select()
      .single();
    assertOk(error, 'depots.updateProduct');
    return data;
  },

  /** Add or remove stock, recording in history */
  async adjustStock(depotId, product, quantity, type, reference) {
    // Update depot_products stock
    const { data: current, error: fetchErr } = await supabase
      .from('depot_products')
      .select('stock')
      .eq('depot_id', depotId)
      .eq('product', product)
      .single();
    assertOk(fetchErr, 'depots.adjustStock:fetch');
    if (!current) throw new Error(`Product ${product} not found for depot`);

    const newStock = Math.max(0, (current.stock ?? 0) + quantity);
    const { error: updateErr } = await supabase
      .from('depot_products')
      .update({ stock: newStock, updated_at: new Date().toISOString() })
      .eq('depot_id', depotId)
      .eq('product', product);
    assertOk(updateErr, 'depots.adjustStock:update');

    // Record in stock history
    const { error: histErr } = await supabase
      .from('stock_history')
      .insert({ depot_id: depotId, product, quantity, type, reference });
    assertOk(histErr, 'depots.adjustStock:history');
  },
};

// ── Orders ───────────────────────────────────────────────────────────────────

export const orders = {
  /**
   * Place a new order. Generates a VTL-XXXXX id via DB function.
   * items: [{ product, volume, pricePerLitre }]
   */
  async create({ buyerId, depotId, deliveryMode, deliveryState, deliveryLga, deliveryAddress, pickupNote, items, vatPercent }) {
    const totalVolume = items.reduce((s, i) => s + i.volume, 0);
    const totalValue = Math.round(items.reduce((s, i) => s + i.pricePerLitre * i.volume, 0));
    // Fetch platform fee percentage from DB (fallback to 1%)
    const { data: feeRow } = await supabase.from('platform_settings').select('value').eq('key', 'platform_fee_percent').maybeSingle();
    const feePercent = parseFloat(feeRow?.value) ?? 1;
    const platformFee = Math.round(totalValue * (feePercent / 100));
    const vatRate = (vatPercent ?? 7.5) / 100;
    const vat = Math.round(totalValue * vatRate);
    const netToDepot = totalValue - platformFee;
    const trucksCount = Math.ceil(totalVolume / 33000);

    // Generate order ID from DB sequence; fall back to timestamp-based ID if not available
    const { data: idRow } = await supabase.rpc('next_order_id');
    const orderId = idRow || `VTL-${Date.now().toString(36).toUpperCase().slice(-5)}`;

    const slaDeadline = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(); // 2h SLA

    const { error: orderErr } = await supabase.from('orders').insert({
      id: orderId,
      buyer_id: buyerId,
      depot_id: depotId,
      status: 'pending',
      delivery_mode: deliveryMode,
      delivery_state: deliveryState || null,
      delivery_lga: deliveryLga || null,
      delivery_address: deliveryAddress || null,
      pickup_note: pickupNote || null,
      total_volume: totalVolume,
      total_value: totalValue,
      platform_fee: platformFee,
      vat,
      net_to_depot: netToDepot,
      trucks_count: trucksCount,
      sla_deadline: slaDeadline,
    });
    assertOk(orderErr, 'orders.create:order');

    const itemRows = items.map((i) => ({
      order_id: orderId,
      product: i.product,
      volume: i.volume,
      price_per_litre: i.pricePerLitre,
      value: i.pricePerLitre * i.volume,
    }));
    const { error: itemsErr } = await supabase.from('order_items').insert(itemRows);
    assertOk(itemsErr, 'orders.create:items');

    // Log initial status
    await supabase.from('order_status_logs').insert({
      order_id: orderId,
      from_status: null,
      to_status: 'pending',
      note: 'Order placed',
      actor_id: buyerId,
    });

    // Hold funds in wallet
    await wallet._hold(buyerId, totalValue + platformFee + vat, orderId);

    return orderId;
  },

  /** Get orders for a buyer (paginated, default 50) */
  async listByBuyer(buyerId, { limit = 50, offset = 0 } = {}) {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (*),
        depots (name, location),
        profiles!orders_buyer_id_fkey (full_name, company_name),
        delivery_negotiations (status)
      `)
      .eq('buyer_id', buyerId)
      .order('placed_at', { ascending: false })
      .range(offset, offset + limit - 1);
    assertOk(error, 'orders.listByBuyer');
    return data;
  },

  /** Get orders for a depot (paginated, default 50) */
  async listByDepot(depotId, { limit = 50, offset = 0 } = {}) {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (*),
        profiles!orders_buyer_id_fkey (full_name, company_name, phone, state, lga, cac_number)
      `)
      .eq('depot_id', depotId)
      .order('placed_at', { ascending: false })
      .range(offset, offset + limit - 1);
    assertOk(error, 'orders.listByDepot');
    return data;
  },

  /** Get a single order with full detail */
  async get(orderId) {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (*),
        order_trucks (*),
        order_status_logs (*, profiles!order_status_logs_actor_id_fkey (full_name)),
        delivery_negotiations (*, delivery_rounds (*)),
        depots (name, location, state, eta),
        profiles!orders_buyer_id_fkey (full_name, company_name, phone, state, lga, cac_number)
      `)
      .eq('id', orderId)
      .single();
    assertOk(error, 'orders.get');
    return data;
  },

  /** Transition order status (depot confirms, rejects, dispatches, etc.) */
  async updateStatus(orderId, toStatus, { actorId, note, patch } = {}) {
    const { data: current, error: fetchErr } = await supabase
      .from('orders')
      .select('status')
      .eq('id', orderId)
      .single();
    assertOk(fetchErr, 'orders.updateStatus:fetch');
    if (!current) throw new Error(`Order ${orderId} not found`);

    // Validate transition
    assertValidTransition(current.status, toStatus);

    const timestamps = {};
    if (toStatus === 'confirmed') timestamps.confirmed_at = new Date().toISOString();
    if (toStatus === 'in_transit') timestamps.dispatched_at = new Date().toISOString();
    if (toStatus === 'delivered' || toStatus === 'collected') {
      timestamps.delivered_at = new Date().toISOString();
    }

    // Optimistic concurrency: only update if status hasn't changed since we read it
    const { data: updated, error: upErr } = await supabase
      .from('orders')
      .update({ status: toStatus, ...timestamps, ...(patch || {}) })
      .eq('id', orderId)
      .eq('status', current.status)
      .select('id')
      .maybeSingle();
    assertOk(upErr, 'orders.updateStatus:order');
    if (!updated) throw new Error(`Order ${orderId} status changed concurrently. Please refresh and try again.`);

    const logRow = { order_id: orderId, to_status: toStatus };
    if (current?.status) logRow.from_status = current.status;
    if (note) logRow.note = note;
    if (actorId) logRow.actor_id = actorId;
    await supabase.from('order_status_logs').insert(logRow);

    // Release escrow on delivery
    if (toStatus === 'delivered' || toStatus === 'collected') {
      const { data: order } = await supabase
        .from('orders')
        .select('total_value, platform_fee, vat, buyer_id')
        .eq('id', orderId)
        .single();
      if (order) {
        await wallet._release(order.buyer_id, order.total_value + order.platform_fee + order.vat, orderId);
      }
    }

    // Refund escrow on rejection/cancellation
    if (toStatus === 'rejected' || toStatus === 'cancelled') {
      const { data: order } = await supabase
        .from('orders')
        .select('total_value, platform_fee, vat, buyer_id')
        .eq('id', orderId)
        .single();
      if (order) {
        await wallet._refund(order.buyer_id, order.total_value + order.platform_fee + order.vat, orderId, toStatus);
      }
    }
  },

  /** Depot assigns a loading bay */
  async assignBay(orderId, bay, loadingRef, actorId) {
    await orders.updateStatus(orderId, 'loading', {
      actorId,
      note: `${bay} assigned · ${loadingRef}`,
      patch: { bay_assigned: bay, loading_ref: loadingRef },
    });
  },

  /** Depot dispatches trucks */
  async dispatch(orderId, trucks, actorId) {
    const truckRows = trucks.map((t, i) => ({ order_id: orderId, truck_index: i, ...t }));
    const { error } = await supabase.from('order_trucks').insert(truckRows);
    assertOk(error, 'orders.dispatch:trucks');
    await orders.updateStatus(orderId, 'in_transit', {
      actorId,
      note: `${trucks.length} truck${trucks.length !== 1 ? 's' : ''} dispatched`,
    });
  },

  /** Update a truck's progress/status */
  async updateTruck(truckId, patch) {
    const { error } = await supabase
      .from('order_trucks')
      .update(patch)
      .eq('id', truckId);
    assertOk(error, 'orders.updateTruck');
  },
};

// ── Delivery Negotiations ─────────────────────────────────────────────────────

export const negotiations = {
  /** Depot sends initial delivery cost quote */
  async sendQuote(orderId, party, amount) {
    if (!['buyer', 'depot'].includes(party)) throw new Error('Invalid party');
    if (!amount || amount <= 0) throw new Error('Quote amount must be positive');
    // Upsert the negotiation record
    const { data: neg, error: negErr } = await supabase
      .from('delivery_negotiations')
      .upsert(
        {
          order_id: orderId,
          status: party === 'depot' ? 'buyer_pending' : 'depot_pending',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'order_id' }
      )
      .select()
      .single();
    assertOk(negErr, 'negotiations.sendQuote:upsert');

    const { error: roundErr } = await supabase
      .from('delivery_rounds')
      .insert({ negotiation_id: neg.id, from_party: party, amount });
    assertOk(roundErr, 'negotiations.sendQuote:round');
    return neg;
  },

  /** Buyer or depot accepts the latest quote */
  async accept(orderId, agreedAmount) {
    const { error } = await supabase
      .from('delivery_negotiations')
      .update({ status: 'agreed', agreed_amount: agreedAmount, updated_at: new Date().toISOString() })
      .eq('order_id', orderId);
    assertOk(error, 'negotiations.accept');
  },

  /** Get negotiation + rounds for an order */
  async get(orderId) {
    const { data, error } = await supabase
      .from('delivery_negotiations')
      .select('*, delivery_rounds (*)')
      .eq('order_id', orderId)
      .maybeSingle();
    assertOk(error, 'negotiations.get');
    return data;
  },
};

// ── Wallet ───────────────────────────────────────────────────────────────────

export const wallet = {
  /** Get wallet balance for a user */
  async get(userId) {
    const { data, error } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    assertOk(error, 'wallet.get');
    return data;
  },

  /** Get transaction history for a user */
  async getTransactions(userId, limit = 50) {
    const { data: w } = await supabase
      .from('wallets')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();
    if (!w) return [];

    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('wallet_id', w.id)
      .order('created_at', { ascending: false })
      .limit(limit);
    assertOk(error, 'wallet.getTransactions');
    return data;
  },

  /** Credit (top-up) — stub until payment gateway is integrated */
  async credit(userId, amount, description, reference) {
    if (!amount || amount <= 0) throw new Error('Amount must be positive');
    const { data: w } = await supabase
      .from('wallets')
      .select('id, balance_ngn')
      .eq('user_id', userId)
      .single();
    if (!w) throw new Error('Wallet not found');

    const { error: wErr } = await supabase
      .from('wallets')
      .update({ balance_ngn: w.balance_ngn + amount, updated_at: new Date().toISOString() })
      .eq('id', w.id);
    assertOk(wErr, 'wallet.credit:balance');

    const { error: txErr } = await supabase.from('transactions').insert({
      wallet_id: w.id, type: 'credit', amount, description, reference,
    });
    assertOk(txErr, 'wallet.credit:transaction');
  },

  /** Internal: hold funds for an order */
  async _hold(userId, amount, orderId) {
    if (!amount || amount <= 0) throw new Error('Hold amount must be positive');
    const { data: w } = await supabase
      .from('wallets')
      .select('id, balance_ngn')
      .eq('user_id', userId)
      .single();
    if (!w) throw new Error('Wallet not found — cannot hold funds');
    if (w.balance_ngn < amount) throw new Error('Insufficient wallet balance');

    const { error: wErr } = await supabase.from('wallets')
      .update({ balance_ngn: w.balance_ngn - amount, updated_at: new Date().toISOString() })
      .eq('id', w.id);
    assertOk(wErr, 'wallet._hold:balance');
    const { error: txErr } = await supabase.from('transactions').insert({
      wallet_id: w.id, type: 'hold', amount,
      description: `Order ${orderId} — Payment held in escrow`,
      order_id: orderId,
    });
    assertOk(txErr, 'wallet._hold:transaction');
  },

  /** Internal: release funds after delivery */
  async _release(userId, amount, orderId) {
    if (!amount || amount <= 0) throw new Error('Release amount must be positive');
    const { data: w } = await supabase
      .from('wallets')
      .select('id')
      .eq('user_id', userId)
      .single();
    if (!w) throw new Error('Wallet not found — cannot release funds');
    const { error: txErr } = await supabase.from('transactions').insert({
      wallet_id: w.id, type: 'release', amount,
      description: `Order ${orderId} — Payment released to depot`,
      order_id: orderId,
    });
    assertOk(txErr, 'wallet._release:transaction');
  },

  /** Internal: refund buyer on rejection/cancellation */
  async _refund(userId, amount, orderId, reason = 'cancelled') {
    if (!amount || amount <= 0) throw new Error('Refund amount must be positive');
    const { data: w } = await supabase
      .from('wallets')
      .select('id, balance_ngn')
      .eq('user_id', userId)
      .single();
    if (!w) throw new Error('Wallet not found — cannot refund');
    const { error: wErr } = await supabase.from('wallets')
      .update({ balance_ngn: w.balance_ngn + amount, updated_at: new Date().toISOString() })
      .eq('id', w.id);
    assertOk(wErr, 'wallet._refund:balance');
    const { error: txErr } = await supabase.from('transactions').insert({
      wallet_id: w.id, type: 'refund', amount,
      description: `Order ${orderId} — Refund (order ${reason})`,
      order_id: orderId,
    });
    assertOk(txErr, 'wallet._refund:transaction');
  },
};

// ── Order State Machine (client-side mirror of DB trigger) ───────────────────

const VALID_TRANSITIONS = {
  pending:    ['confirmed', 'rejected', 'cancelled'],
  confirmed:  ['loading', 'cancelled'],
  loading:    ['in_transit', 'collected'],
  in_transit: ['delivered', 'collected', 'disputed'],
  delivered:  ['disputed'],
  collected:  [],
  disputed:   ['delivered', 'collected'],
  rejected:   [],
  cancelled:  [],
};

/** Throws if the transition is not allowed. */
export function assertValidTransition(from, to) {
  if (from === to) return;
  const allowed = VALID_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new Error(`Cannot move order from "${from}" to "${to}". Allowed next states: ${allowed.join(', ') || 'none (terminal)'}.`);
  }
}

// ── KYC (individual / company verification) ──────────────────────────────────

export const kyc = {
  /** Upload one KYC document to Supabase Storage and record it in kyc_documents. */
  async uploadDocument(userId, type, file) {
    const compressed = await compressImage(file);
    const ext = compressed.name.split('.').pop().toLowerCase();
    const path = `${userId}/${type}-${Date.now()}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from('kyc-documents')
      .upload(path, compressed, { upsert: true, contentType: compressed.type });
    assertOk(upErr, 'kyc.uploadDocument:storage');

    const { error: dbErr } = await supabase
      .from('kyc_documents')
      .upsert(
        { user_id: userId, type, file_path: path, file_name: file.name, file_size: file.size },
        { onConflict: 'user_id,type' }
      );
    assertOk(dbErr, 'kyc.uploadDocument:db');

    return path;
  },

  /** Get a short-lived signed URL to preview a private KYC document. */
  async getSignedUrl(filePath, expiresIn = 300) {
    const { data, error } = await supabase.storage
      .from('kyc-documents')
      .createSignedUrl(filePath, expiresIn);
    assertOk(error, 'kyc.getSignedUrl');
    return data.signedUrl;
  },

  /** Get all uploaded KYC documents for a user. */
  async getDocuments(userId) {
    const { data, error } = await supabase
      .from('kyc_documents')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    assertOk(error, 'kyc.getDocuments');
    return data ?? [];
  },

  /**
   * Submit KYC for review. Sets kyc_status → 'submitted' on the profile.
   * All required documents must be uploaded before calling this.
   */
  async submit(userId) {
    const { error } = await supabase
      .from('profiles')
      .update({ kyc_status: 'submitted', updated_at: new Date().toISOString() })
      .eq('id', userId);
    assertOk(error, 'kyc.submit');
  },
};

// ── KYB (depot-level verification) ───────────────────────────────────────────

export const kyb = {
  /** Upload one KYB document to Supabase Storage and record it in kyb_documents. */
  async uploadDocument(depotId, userId, type, file) {
    const compressed = await compressImage(file);
    const ext = compressed.name.split('.').pop().toLowerCase();
    const path = `${userId}/${depotId}/${type}-${Date.now()}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from('kyb-documents')
      .upload(path, compressed, { upsert: true, contentType: compressed.type });
    assertOk(upErr, 'kyb.uploadDocument:storage');

    const { error: dbErr } = await supabase
      .from('kyb_documents')
      .upsert(
        { depot_id: depotId, type, file_path: path, file_name: file.name, file_size: file.size },
        { onConflict: 'depot_id,type' }
      );
    assertOk(dbErr, 'kyb.uploadDocument:db');

    return path;
  },

  /** Get a short-lived signed URL to preview a private KYB document. */
  async getSignedUrl(filePath, expiresIn = 300) {
    const { data, error } = await supabase.storage
      .from('kyb-documents')
      .createSignedUrl(filePath, expiresIn);
    assertOk(error, 'kyb.getSignedUrl');
    return data.signedUrl;
  },

  /** Get all uploaded KYB documents for a depot. */
  async getDocuments(depotId) {
    const { data, error } = await supabase
      .from('kyb_documents')
      .select('*')
      .eq('depot_id', depotId)
      .order('created_at', { ascending: false });
    assertOk(error, 'kyb.getDocuments');
    return data ?? [];
  },

  /**
   * Submit KYB for review. Sets kyb_status → 'submitted' on the depot.
   * All required documents must be uploaded before calling this.
   */
  async submit(depotId) {
    const { error } = await supabase
      .from('depots')
      .update({ kyb_status: 'submitted', updated_at: new Date().toISOString() })
      .eq('id', depotId);
    assertOk(error, 'kyb.submit');
  },
};

// ── Prices ───────────────────────────────────────────────────────────────────

export const prices = {
  /** Get 30-day price history for one or all products */
  async getHistory(product = null, days = 30) {
    let query = supabase
      .from('price_history')
      .select('*')
      .gte('recorded_at', new Date(Date.now() - days * 86400000).toISOString().split('T')[0])
      .order('recorded_at', { ascending: true });
    if (product) query = query.eq('product', product);

    const { data, error } = await query;
    assertOk(error, 'prices.getHistory');
    return data;
  },

  /** Get latest price for each product */
  async getCurrent() {
    const products = ['PMS', 'AGO', 'DPK', 'LPG', 'ATK'];
    const { data, error } = await supabase
      .from('price_history')
      .select('product, price, recorded_at')
      .in('product', products)
      .order('recorded_at', { ascending: false });
    assertOk(error, 'prices.getCurrent');
    // Pick the first (latest) row per product
    const seen = new Set();
    const latest = [];
    for (const row of (data || [])) {
      if (!seen.has(row.product)) {
        seen.add(row.product);
        latest.push({ product: row.product, price: row.price, date: row.recorded_at });
      }
    }
    // Fill nulls for any products with no history
    for (const p of products) {
      if (!seen.has(p)) latest.push({ product: p, price: null, date: null });
    }
    return latest;
  },
};

// ── Notification Preferences ──────────────────────────────────────────────────

export const notifications = {
  /** Load notif_prefs from profiles row for a user */
  async getPrefs(userId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('notif_prefs')
      .eq('id', userId)
      .single();
    assertOk(error, 'notifications.getPrefs');
    return data?.notif_prefs ?? null;
  },

  /** Save notif_prefs to profiles row */
  async savePrefs(userId, prefs) {
    const { error } = await supabase
      .from('profiles')
      .update({ notif_prefs: prefs })
      .eq('id', userId);
    assertOk(error, 'notifications.savePrefs');
  },

  /** Get notification history for a user (most recent first) */
  async getHistory(userId, limit = 30) {
    const { data, error } = await supabase
      .from('notification_log')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    assertOk(error, 'notifications.getHistory');
    return data ?? [];
  },

  /**
   * Send a notification by calling the send-notification Edge Function.
   * Falls back silently if the function is not deployed.
   */
  async send({ userId, type, channel = 'email', toEmail, toPhone, data = {} }) {
    const { data: fnData, error } = await supabase.functions.invoke('send-notification', {
      body: {
        user_id: userId,
        type,
        channel,
        to_email: toEmail,
        to_phone: toPhone,
        data,
      },
    });
    if (error) {
      console.warn('[notifications.send] Edge Function not available:', error.message);
      return null;
    }
    return fnData;
  },
};

// ── Team Members ──────────────────────────────────────────────────────────────

export const teamMembers = {
  /** List all members (active, inactive, pending) for a depot */
  async list(depotId) {
    const { data, error } = await supabase
      .from('depot_members')
      .select('*')
      .eq('depot_id', depotId)
      .order('created_at', { ascending: true });
    assertOk(error, 'teamMembers.list');
    return data || [];
  },

  /** Invite a new member (creates a pending row, then sends invite email) */
  async invite({ depotId, email, name, role, invitedBy, depotName }) {
    const { data, error } = await supabase
      .from('depot_members')
      .upsert(
        { depot_id: depotId, email, name: name || '', role, status: 'pending', invited_by: invitedBy },
        { onConflict: 'depot_id,email' }
      )
      .select()
      .single();
    assertOk(error, 'teamMembers.invite');

    // Send invite email (fire-and-forget — never block or throw)
    try {
      notifications.send({
        userId: invitedBy,
        type: 'team_invite',
        channel: 'email',
        toEmail: email,
        data: { name: name || '', depotName: depotName || 'a depot', depotId, email, role },
      }).catch(() => {});
    } catch (_) { /* edge function not deployed — invite still succeeds */ }

    return data;
  },

  /** Update a member's role */
  async updateRole(memberId, role) {
    const { error } = await supabase
      .from('depot_members')
      .update({ role })
      .eq('id', memberId);
    assertOk(error, 'teamMembers.updateRole');
  },

  /** Toggle active/inactive status */
  async setStatus(memberId, status) {
    const { error } = await supabase
      .from('depot_members')
      .update({ status })
      .eq('id', memberId);
    assertOk(error, 'teamMembers.setStatus');
  },

  /** Remove a member entirely */
  async remove(memberId) {
    const { error } = await supabase
      .from('depot_members')
      .delete()
      .eq('id', memberId);
    assertOk(error, 'teamMembers.remove');
  },

  /** Revoke a pending invite */
  async revokeInvite(memberId) {
    const { error } = await supabase
      .from('depot_members')
      .delete()
      .eq('id', memberId)
      .eq('status', 'pending');
    assertOk(error, 'teamMembers.revokeInvite');
  },
};
