/**
 * Ventryl App Store — real-data layer
 * Fetches from Supabase and adapts rows into the shapes the UI already expects.
 */
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { orders as ordersApi, depots as depotsApi, prices as pricesApi } from '../lib/api';

// ── Helpers ───────────────────────────────────────────────────────────────────

const PRODUCT_NAMES = {
  PMS: 'Premium Motor Spirit',
  AGO: 'Automotive Gas Oil',
  DPK: 'Dual Purpose Kerosene',
  LPG: 'Liquefied Petroleum Gas',
  ATK: 'Aviation Turbine Kerosene',
};

function statusToProgress(status) {
  return { pending: 5, confirmed: 20, loading: 40, in_transit: 65, delivered: 100, collected: 100, disputed: 50 }[status] ?? 0;
}

function timeAgo(ms) {
  const diff = Date.now() - ms;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

function fmtDate(iso, opts = { month: 'short', day: 'numeric' }) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('en-NG', opts);
}

function fmtDateTime(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-NG', { month: 'short', day: 'numeric', year: 'numeric' });
  const time = d.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });
  return `${date} · ${time}`;
}

function slaLeft(iso) {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'Expired';
  return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
}

// ── Adapters ─────────────────────────────────────────────────────────────────

/** DB order row → ORDERS list-item shape */
function adaptOrder(row) {
  const items = row.order_items || [];
  const product = items.map(i => i.product).join(' + ') || '—';
  const neg = row.delivery_negotiations?.[0];
  return {
    id: row.id,
    buyer: row.profiles?.company_name || row.profiles?.full_name || '',
    depot: row.depots?.name || '',
    product,
    vol: row.total_volume || 0,
    value: row.total_value || 0,
    status: row.status,
    placed: fmtDate(row.placed_at) || '',
    trucks: row.trucks_count || 0,
    progress: statusToProgress(row.status),
    pendingQuote: neg?.status === 'buyer_pending',
    _raw: row,
  };
}

/** DB order row → INCOMING depot-inbox shape */
function adaptIncoming(row) {
  const items = row.order_items || [];
  const product = items.map(i => i.product).join(' + ') || '—';
  const buyer = row.profiles || {};
  const placed = row.placed_at ? new Date(row.placed_at).getTime() : Date.now();
  return {
    id: row.id,
    buyer: buyer.company_name || buyer.full_name || 'Unknown',
    type: 'Buyer',
    product,
    vol: row.total_volume || 0,
    value: row.total_value || 0,
    trucks: row.trucks_count || 0,
    location: buyer.lga ? `${buyer.lga}, ${buyer.state || ''}` : (buyer.state || ''),
    submitted: timeAgo(placed),
    slaLeft: row.status === 'confirmed' ? 'Confirmed' : slaLeft(row.sla_deadline) || '—',
    status: row.status,
    _raw: row,
  };
}

/** DB verified depots list → marketplace DEPOTS shape */
function adaptMarketDepot(row) {
  const prods = row.depot_products || [];
  const getPrice = (p) => prods.find(x => x.product === p && x.is_active !== false)?.price_per_litre ?? null;
  const totalStock = prods.reduce((s, p) => s + (p.stock || 0), 0);
  return {
    id: row.id,
    name: row.name,
    location: row.location || `${row.lga || ''}, ${row.state || ''}`.replace(/^, /, ''),
    pms: getPrice('PMS'),
    ago: getPrice('AGO'),
    dpk: getPrice('DPK'),
    lpg: getPrice('LPG'),
    atk: getPrice('ATK'),
    stock: totalStock,
    cap: row.capacity || 100000,
    rating: row.rating || 4.5,
    orders: row.total_orders || 0,
    slots: row.slots_available || 4,
    eta: row.eta || '4–8h',
  };
}

/** DB owner depot row → VentrylPlatform depots shape */
function adaptOwnerDepot(row) {
  return {
    id: row.id,
    name: row.name,
    location: row.location || `${row.lga || ''}, ${row.state || ''}`.replace(/^, /, ''),
    kyb: row.kyb_status || 'pending',
    kybRejectionReason: row.kyb_rejection_reason || null,
    license: row.license_number || '',
    capacity: row.capacity || 0,
    orders: row.total_orders || 0,
    rating: row.rating || 0,
    vcs: row.vcs || 300,
    products: (row.depot_products || []).map(p => ({
      id: p.id,
      name: p.product,
      pricePerLitre: p.price_per_litre || 0,
      stock: p.stock || 0,
      threshold: p.threshold || 5000,
      is_active: p.is_active !== false,
    })),
    stockHistory: (row.stock_history || []).map(h => ({
      id: h.id,
      date: fmtDate(h.created_at) || '',
      product: h.product,
      qty: h.quantity,
      type: h.type,
      ref: h.reference || '',
    })),
    _raw: row,
  };
}

/** price_history rows → [{day, pms, ago, ...}] */
function adaptPriceHistory(rows) {
  const byDay = {};
  for (const row of rows) {
    const day = fmtDate(row.recorded_at);
    if (!byDay[day]) byDay[day] = { day };
    byDay[day][row.product.toLowerCase()] = row.price;
  }
  return Object.values(byDay);
}

/** wallet row + transaction rows → NGN wallet shape */
function adaptWalletNGN(walletRow, txnRows) {
  const balanceNGN = parseFloat(walletRow?.balance_ngn ?? 0);
  const txn = (txnRows || []).map(t => {
    const amtNGN = parseFloat(t.amount || 0);
    const isCredit = ['credit', 'release'].includes(t.type);
    const isDebit  = ['debit', 'hold', 'fee'].includes(t.type);
    return {
      id: t.reference || t.id,
      desc: t.description || t.type,
      amount: `${isCredit ? '+' : isDebit ? '-' : ''}₦${amtNGN.toLocaleString('en-NG')}`,
      date: fmtDate(t.created_at) || '',
      type: isCredit ? 'credit' : isDebit ? 'debit' : 'paid',
    };
  });
  return {
    balanceNGN,
    balance: balanceNGN * 100,  // kept for legacy references
    escrowBalance: 0,
    txn,
  };
}

/** Full order detail row → ORDER_META shape */
function adaptOrderDetail(row) {
  const items = row.order_items || [];
  const trucks = (row.order_trucks || []).sort((a, b) => (a.truck_index ?? 0) - (b.truck_index ?? 0));
  const logs = (row.order_status_logs || []).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const buyer = row.profiles || {};
  const depot = row.depots || {};
  const neg = row.delivery_negotiations?.[0] || null;

  const trucks_detail = trucks.length
    ? trucks.map((t, i) => ({
        id: `T${i + 1}`,
        _dbId: t.id,           // real UUID from order_trucks — used for per-truck DB updates
        driver: t.driver_name || 'TBD',
        plate: t.plate_number || 'TBD',
        vol: t.volume || Math.ceil(row.total_volume / (row.trucks_count || 1)),
        departure: t.departure_time || 'TBD',
        eta: t.eta || 'TBD',
        arrivalTime: t.arrival_time || null,
        progress: t.progress || 0,
        status: t.status || row.status,
      }))
    : Array.from({ length: row.trucks_count || 1 }, (_, i) => ({
        id: `T${i + 1}`, driver: 'TBD', plate: 'TBD',
        vol: Math.ceil((row.total_volume || 0) / (row.trucks_count || 1)),
        departure: 'TBD', eta: 'TBD', arrivalTime: null, progress: 0,
        status: row.status === 'in_transit' ? 'in_transit' : row.status,
      }));

  const buyerId = row.buyer_id;
  const timeline = logs.map(log => ({
    from: log.from_status || null,
    to: log.to_status || null,
    note: log.note || null,
    time: fmtDateTime(log.created_at) || '',
    actor: log.actor_id ? (log.actor_id === buyerId ? 'buyer' : 'depot') : 'system',
  }));

  const products = items.length > 1
    ? items.map(it => ({
        name: it.product,
        fullName: PRODUCT_NAMES[it.product] || it.product,
        vol: it.volume,
        pricePerLitre: it.price_per_litre,
        value: it.value,
        trucks: Math.ceil(it.volume / 33000),
      }))
    : null;

  return {
    status: row.status || 'pending',
    buyer: {
      name: buyer.full_name || '',
      company: buyer.company_name || '',
      type: 'Buyer',
      phone: buyer.phone || '',
      email: '',
      location: [buyer.lga, buyer.state].filter(Boolean).join(', '),
      rc: buyer.cac_number || '',
    },
    depot: {
      name: depot.name || '',
      location: depot.location || depot.state || '',
      contact: '',
    },
    delivery: {
      mode: row.delivery_mode || 'delivery',
      state: row.delivery_state || null,
      lga: row.delivery_lga || null,
      address: row.delivery_address || null,
    },
    product: items.map(i => i.product).join(' + '),
    ...(products && { products }),
    vol: row.total_volume || 0,
    pricePerLitre: items[0]?.price_per_litre || 0,
    value: row.total_value || 0,
    trucks: row.trucks_count || 0,
    placed: fmtDateTime(row.placed_at),
    confirmed: fmtDateTime(row.confirmed_at),
    dispatchDate: fmtDateTime(row.dispatched_at),
    deliveredDate: fmtDateTime(row.delivered_at),
    bay: row.bay_assigned || null,
    loadingRef: row.loading_ref || null,
    slaLeft: slaLeft(row.sla_deadline),
    trucks_detail,
    timeline,
    financials: {
      productValue: row.total_value || 0,
      platformFee: row.platform_fee || 0,
      vat: row.vat || 0,
      netToDepot: row.net_to_depot || 0,
      paymentStatus: ['delivered', 'collected'].includes(row.status) ? 'paid' : 'processing',
    },
    _negotiation: neg,
  };
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useVentrylStore = create((set, get) => ({

  // ── Market depots (buyer marketplace) ──────────────────────────────────────
  marketDepots: [],
  marketDepotsLoaded: false,

  async loadMarketDepots() {
    try {
      const rows = await depotsApi.list();
      set({ marketDepots: rows.map(adaptMarketDepot), marketDepotsLoaded: true });
    } catch (e) {
      console.error('[ventrylStore] loadMarketDepots', e.message);
    }
  },

  // ── Owner depots (depot management panel) ──────────────────────────────────
  ownerDepots: [],
  ownerDepotsLoaded: false,

  async loadOwnerDepots(ownerId) {
    if (!ownerId) return;
    try {
      const rows = await depotsApi.listByOwner(ownerId);
      set({ ownerDepots: rows.map(adaptOwnerDepot), ownerDepotsLoaded: true });
    } catch (e) {
      console.error('[ventrylStore] loadOwnerDepots', e.message);
    }
  },

  // ── Buyer orders ────────────────────────────────────────────────────────────
  buyerOrders: [],
  buyerOrdersLoaded: false,
  buyerOrdersHasMore: true,

  async loadBuyerOrders(userId, { loadMore = false } = {}) {
    if (!userId) return;
    try {
      const current = loadMore ? get().buyerOrders : [];
      const rows = await ordersApi.listByBuyer(userId, { limit: 50, offset: current.length });
      const adapted = rows.map(adaptOrder);
      set({
        buyerOrders: loadMore ? [...current, ...adapted] : adapted,
        buyerOrdersLoaded: true,
        buyerOrdersHasMore: rows.length === 50,
      });
    } catch (e) {
      console.error('[ventrylStore] loadBuyerOrders', e.message);
    }
  },

  // ── Depot orders (inbox per depot) ──────────────────────────────────────────
  depotOrders: {},   // depotId → incoming[]
  depotOrdersHasMore: {},

  async loadDepotOrders(depotId, { loadMore = false } = {}) {
    if (!depotId) return;
    try {
      const current = loadMore ? (get().depotOrders[depotId] || []) : [];
      const rows = await ordersApi.listByDepot(depotId, { limit: 50, offset: current.length });
      const adapted = rows.map(adaptIncoming);
      set(s => ({
        depotOrders: { ...s.depotOrders, [depotId]: loadMore ? [...current, ...adapted] : adapted },
        depotOrdersHasMore: { ...s.depotOrdersHasMore, [depotId]: rows.length === 50 },
      }));
    } catch (e) {
      console.error('[ventrylStore] loadDepotOrders', e.message);
    }
  },

  // ── Price history (charts) ──────────────────────────────────────────────────
  priceHistory: [],

  async loadPriceHistory(days = 7) {
    try {
      const rows = await pricesApi.getHistory(null, days);
      set({ priceHistory: adaptPriceHistory(rows) });
    } catch (e) {
      console.error('[ventrylStore] loadPriceHistory', e.message);
    }
  },

  // ── Wallet ──────────────────────────────────────────────────────────────────
  walletNGN: null,

  async loadWallet(userId) {
    if (!userId) return;
    try {
      const { data } = await supabase
        .from('wallets')
        .select('*, transactions(*)')
        .eq('user_id', userId)
        .order('created_at', { referencedTable: 'transactions', ascending: false })
        .limit(50, { referencedTable: 'transactions' })
        .maybeSingle();
      const txnRows = data?.transactions || [];
      set({ walletNGN: adaptWalletNGN(data, txnRows) });
    } catch (e) {
      console.error('[ventrylStore] loadWallet', e.message);
    }
  },

  // ── Order detail cache ──────────────────────────────────────────────────────
  orderDetails: {},  // orderId → adapted meta object

  async loadOrderDetail(orderId, force = false) {
    if (!orderId) return;
    if (!force && get().orderDetails[orderId]) return;
    try {
      const row = await ordersApi.get(orderId);
      set(s => ({
        orderDetails: { ...s.orderDetails, [orderId]: adaptOrderDetail(row) },
      }));
    } catch (e) {
      console.error('[ventrylStore] loadOrderDetail', e.message);
    }
  },

  // Invalidate one order's detail (call after status mutation)
  invalidateOrderDetail(orderId) {
    set(s => {
      const next = { ...s.orderDetails };
      delete next[orderId];
      return { orderDetails: next };
    });
  },

  // Reset all store data (call on sign-out to prevent data leaks between accounts)
  reset() {
    set({
      marketDepots: [], marketDepotsLoaded: false,
      ownerDepots: [], ownerDepotsLoaded: false,
      buyerOrders: [], buyerOrdersLoaded: false, buyerOrdersHasMore: true,
      depotOrders: {}, depotOrdersHasMore: {},
      priceHistory: [],
      walletNGN: null,
      orderDetails: {},
    });
  },
}));
