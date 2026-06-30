/**
 * Ventryl API Service Layer
 * All data operations go through this module. Abstracts Supabase calls.
 */
import { supabase } from './supabase';

// ── Helpers ──────────────────────────────────────────────────────────────────

function assertOk(error, context) {
  if (error) throw new Error(`[${context}] ${error.message}`);
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export const auth = {
  /** Sign up a new user and create their profile */
  async signUp({ email, password, fullName, companyName, role, phone }) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, company_name: companyName, role, phone },
      },
    });
    assertOk(error, 'auth.signUp');
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

  /** Create a new depot (KYB pending by default) */
  async create({ ownerId, name, location, state, lga, address, licenseNumber, licenseExpiry, capacity, products }) {
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
        kyb_status: 'pending',
      })
      .select()
      .single();
    assertOk(depotErr, 'depots.create');

    if (products?.length) {
      const productRows = products.map((product) => ({
        depot_id: depot.id,
        product,
        price_per_litre: 0,
        stock: 0,
        threshold: 5000,
      }));
      const { error: prodErr } = await supabase.from('depot_products').insert(productRows);
      assertOk(prodErr, 'depots.create:products');
    }

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
    const { data: current } = await supabase
      .from('depot_products')
      .select('stock')
      .eq('depot_id', depotId)
      .eq('product', product)
      .single();

    const newStock = (current?.stock ?? 0) + quantity;
    const { error: updateErr } = await supabase
      .from('depot_products')
      .update({ stock: Math.max(0, newStock), updated_at: new Date().toISOString() })
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
  async create({ buyerId, depotId, deliveryMode, deliveryState, deliveryLga, deliveryAddress, pickupNote, items }) {
    const totalVolume = items.reduce((s, i) => s + i.volume, 0);
    const totalValue = items.reduce((s, i) => s + i.pricePerLitre * i.volume, 0);
    const platformFee = Math.round(totalValue * 0.01);
    const vat = Math.round(platformFee * 0.075);
    const netToDepot = totalValue - platformFee;
    const trucksCount = Math.ceil(totalVolume / 33000);

    // Generate order ID from DB sequence
    const { data: idRow, error: idErr } = await supabase.rpc('next_order_id');
    assertOk(idErr, 'orders.create:id');
    const orderId = idRow;

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

  /** Get all orders for a buyer */
  async listByBuyer(buyerId) {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (*),
        depots (name, location),
        profiles!orders_buyer_id_fkey (full_name, company_name)
      `)
      .eq('buyer_id', buyerId)
      .order('placed_at', { ascending: false });
    assertOk(error, 'orders.listByBuyer');
    return data;
  },

  /** Get all orders for a depot (inbox) */
  async listByDepot(depotId) {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (*),
        profiles!orders_buyer_id_fkey (full_name, company_name, phone, state, lga, cac_number)
      `)
      .eq('depot_id', depotId)
      .order('placed_at', { ascending: false });
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
    const { data: current } = await supabase
      .from('orders')
      .select('status')
      .eq('id', orderId)
      .single();

    const timestamps = {};
    if (toStatus === 'confirmed') timestamps.confirmed_at = new Date().toISOString();
    if (toStatus === 'in_transit') timestamps.dispatched_at = new Date().toISOString();
    if (toStatus === 'delivered' || toStatus === 'collected') {
      timestamps.delivered_at = new Date().toISOString();
    }

    const { error: upErr } = await supabase
      .from('orders')
      .update({ status: toStatus, ...timestamps, ...(patch || {}) })
      .eq('id', orderId);
    assertOk(upErr, 'orders.updateStatus:order');

    await supabase.from('order_status_logs').insert({
      order_id: orderId,
      from_status: current?.status ?? null,
      to_status: toStatus,
      note: note || null,
      actor_id: actorId || null,
    });

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
        await wallet._refund(order.buyer_id, order.total_value + order.platform_fee + order.vat, orderId);
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
      .single();
    assertOk(error, 'wallet.get');
    return data;
  },

  /** Get transaction history for a user */
  async getTransactions(userId, limit = 50) {
    const { data: w } = await supabase
      .from('wallets')
      .select('id')
      .eq('user_id', userId)
      .single();
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

    await supabase.from('transactions').insert({
      wallet_id: w.id, type: 'credit', amount, description, reference,
    });
  },

  /** Internal: hold funds for an order */
  async _hold(userId, amount, orderId) {
    const { data: w } = await supabase
      .from('wallets')
      .select('id, balance_ngn')
      .eq('user_id', userId)
      .single();
    if (!w) return;
    if (w.balance_ngn < amount) throw new Error('Insufficient wallet balance');

    await supabase.from('wallets')
      .update({ balance_ngn: w.balance_ngn - amount, updated_at: new Date().toISOString() })
      .eq('id', w.id);
    await supabase.from('transactions').insert({
      wallet_id: w.id, type: 'hold', amount,
      description: `Order ${orderId} — Payment held in escrow`,
      order_id: orderId,
    });
  },

  /** Internal: release funds after delivery */
  async _release(userId, amount, orderId) {
    const { data: w } = await supabase
      .from('wallets')
      .select('id')
      .eq('user_id', userId)
      .single();
    if (!w) return;
    await supabase.from('transactions').insert({
      wallet_id: w.id, type: 'release', amount,
      description: `Order ${orderId} — Payment released to depot`,
      order_id: orderId,
    });
  },

  /** Internal: refund buyer on rejection/cancellation */
  async _refund(userId, amount, orderId) {
    const { data: w } = await supabase
      .from('wallets')
      .select('id, balance_ngn')
      .eq('user_id', userId)
      .single();
    if (!w) return;
    await supabase.from('wallets')
      .update({ balance_ngn: w.balance_ngn + amount, updated_at: new Date().toISOString() })
      .eq('id', w.id);
    await supabase.from('transactions').insert({
      wallet_id: w.id, type: 'credit', amount,
      description: `Order ${orderId} — Refund (order ${orderId.includes('reject') ? 'rejected' : 'cancelled'})`,
      order_id: orderId,
    });
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
    const results = await Promise.all(
      products.map(async (product) => {
        const { data } = await supabase
          .from('price_history')
          .select('price, recorded_at')
          .eq('product', product)
          .order('recorded_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        return { product, price: data?.price ?? null, date: data?.recorded_at ?? null };
      })
    );
    return results;
  },
};
