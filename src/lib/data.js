// ──────────────────────────────────────────────────────────────────
//  Mock data layer – mirrors real Nigerian petroleum market structures
//  Replace with API calls when backend is ready.
// ──────────────────────────────────────────────────────────────────

import { subDays, subHours, subMinutes } from 'date-fns';

const now = new Date();

// ── Depots ────────────────────────────────────────────────────────
export const DEPOTS = [
  {
    id: 'd1', name: 'Pinnacle Energy Depot', state: 'Lagos',
    address: 'Apapa Tank Farm, Apapa, Lagos', tier: 'certified',
    capacity: 12_000_000, rating: 4.8, totalTrades: 342, verified: true,
    contact: '+234 802 123 4567', email: 'ops@pinnacle.ng',
    products: ['PMS', 'AGO', 'DPK'],
    lat: 6.4432, lng: 3.3554,
  },
  {
    id: 'd2', name: 'Stallion Petroleum Ltd', state: 'Rivers',
    address: 'Trans-Amadi Industrial Layout, Port Harcourt', tier: 'certified',
    capacity: 8_500_000, rating: 4.6, totalTrades: 215, verified: true,
    contact: '+234 803 456 7890', email: 'trade@stallion.ng',
    products: ['PMS', 'AGO', 'ATK'],
    lat: 4.8156, lng: 7.0498,
  },
  {
    id: 'd3', name: 'Northern Fuel Associates', state: 'Kaduna',
    address: 'Mando Road Industrial Area, Kaduna', tier: 'verified',
    capacity: 6_200_000, rating: 4.3, totalTrades: 178, verified: true,
    contact: '+234 807 234 5678', email: 'info@northernfuel.ng',
    products: ['PMS', 'AGO', 'LPG'],
    lat: 10.5105, lng: 7.4165,
  },
  {
    id: 'd4', name: 'Atlas Depot & Logistics', state: 'Delta',
    address: 'Effurun-Sapele Road, Warri, Delta State', tier: 'certified',
    capacity: 9_800_000, rating: 4.7, totalTrades: 289, verified: true,
    contact: '+234 808 345 6789', email: 'ops@atlas.ng',
    products: ['AGO', 'DPK', 'ATK'],
    lat: 5.5162, lng: 5.7542,
  },
  {
    id: 'd5', name: 'Capital City Energy', state: 'Abuja (FCT)',
    address: 'Phase 4, Kubwa, Abuja', tier: 'verified',
    capacity: 4_500_000, rating: 4.2, totalTrades: 94, verified: false,
    contact: '+234 809 456 7890', email: 'trade@capitalcity.ng',
    products: ['PMS', 'LPG'],
    lat: 9.0579, lng: 7.4951,
  },
  {
    id: 'd6', name: 'Equity Petroleum Resources', state: 'Oyo',
    address: 'Sango-Ota Expressway, Ibadan', tier: 'standard',
    capacity: 3_200_000, rating: 3.9, totalTrades: 61, verified: false,
    contact: '+234 810 567 8901', email: 'hello@equitypetro.ng',
    products: ['PMS', 'AGO'],
    lat: 7.3775, lng: 3.9470,
  },
];

// ── Market Listings ────────────────────────────────────────────────
export const LISTINGS = [
  {
    id: 'l1', depotId: 'd1', depotName: 'Pinnacle Energy Depot',
    product: 'PMS', volume: 1_000_000, minOrder: 33_000,
    pricePerLitre: 872, state: 'Lagos', status: 'active',
    expiresAt: subDays(now, -3).toISOString(),
    postedAt: subHours(now, 2).toISOString(),
    paymentTerms: 'Cash before delivery', deliveryMode: 'Ex-depot',
    verified: true, bids: 7,
  },
  {
    id: 'l2', depotId: 'd2', depotName: 'Stallion Petroleum Ltd',
    product: 'AGO', volume: 500_000, minOrder: 33_000,
    pricePerLitre: 1_150, state: 'Rivers', status: 'active',
    expiresAt: subDays(now, -2).toISOString(),
    postedAt: subHours(now, 5).toISOString(),
    paymentTerms: '50% upfront', deliveryMode: 'Ex-depot & Delivery',
    verified: true, bids: 4,
  },
  {
    id: 'l3', depotId: 'd4', depotName: 'Atlas Depot & Logistics',
    product: 'AGO', volume: 750_000, minOrder: 33_000,
    pricePerLitre: 1_145, state: 'Delta', status: 'active',
    expiresAt: subDays(now, -5).toISOString(),
    postedAt: subHours(now, 8).toISOString(),
    paymentTerms: 'Cash before delivery', deliveryMode: 'Ex-depot',
    verified: true, bids: 12,
  },
  {
    id: 'l4', depotId: 'd3', depotName: 'Northern Fuel Associates',
    product: 'PMS', volume: 600_000, minOrder: 33_000,
    pricePerLitre: 878, state: 'Kaduna', status: 'active',
    expiresAt: subDays(now, -1).toISOString(),
    postedAt: subHours(now, 14).toISOString(),
    paymentTerms: 'Cash before delivery', deliveryMode: 'Ex-depot',
    verified: true, bids: 3,
  },
  {
    id: 'l5', depotId: 'd3', depotName: 'Northern Fuel Associates',
    product: 'LPG', volume: 80_000, minOrder: 5_000,
    pricePerLitre: 620, state: 'Kaduna', status: 'active',
    expiresAt: subDays(now, -4).toISOString(),
    postedAt: subDays(now, 1).toISOString(),
    paymentTerms: '50% upfront', deliveryMode: 'Delivery only',
    verified: true, bids: 1,
  },
  {
    id: 'l6', depotId: 'd1', depotName: 'Pinnacle Energy Depot',
    product: 'DPK', volume: 400_000, minOrder: 33_000,
    pricePerLitre: 610, state: 'Lagos', status: 'active',
    expiresAt: subDays(now, -2).toISOString(),
    postedAt: subDays(now, 1).toISOString(),
    paymentTerms: 'Cash before delivery', deliveryMode: 'Ex-depot',
    verified: true, bids: 8,
  },
  {
    id: 'l7', depotId: 'd5', depotName: 'Capital City Energy',
    product: 'PMS', volume: 200_000, minOrder: 33_000,
    pricePerLitre: 885, state: 'Abuja (FCT)', status: 'active',
    expiresAt: subDays(now, -7).toISOString(),
    postedAt: subDays(now, 2).toISOString(),
    paymentTerms: 'Cash before delivery', deliveryMode: 'Ex-depot',
    verified: false, bids: 2,
  },
  {
    id: 'l8', depotId: 'd6', depotName: 'Equity Petroleum Resources',
    product: 'AGO', volume: 300_000, minOrder: 33_000,
    pricePerLitre: 1_160, state: 'Oyo', status: 'closed',
    expiresAt: subDays(now, 2).toISOString(),
    postedAt: subDays(now, 5).toISOString(),
    paymentTerms: 'Cash before delivery', deliveryMode: 'Ex-depot',
    verified: false, bids: 0,
  },
];

// ── Orders ─────────────────────────────────────────────────────────
export const ORDERS = [
  {
    id: 'ORD-2026-0421', listingId: 'l1', depotId: 'd1',
    depotName: 'Pinnacle Energy Depot', product: 'PMS',
    volume: 33_000, pricePerLitre: 872,
    totalValue: 33_000 * 872,
    status: 'in_transit', state: 'Lagos',
    createdAt: subDays(now, 2).toISOString(),
    updatedAt: subHours(now, 6).toISOString(),
    estimatedDelivery: subDays(now, -1).toISOString(),
    truckPlate: 'LND 421 AA', driver: 'Emeka Okafor',
    driverPhone: '+234 813 001 2233',
    wayBillNo: 'WB-2026-1103',
    notes: 'Load from tank 3. Night loading approved.',
  },
  {
    id: 'ORD-2026-0415', listingId: 'l2', depotId: 'd2',
    depotName: 'Stallion Petroleum Ltd', product: 'AGO',
    volume: 33_000, pricePerLitre: 1_150,
    totalValue: 33_000 * 1_150,
    status: 'delivered', state: 'Rivers',
    createdAt: subDays(now, 8).toISOString(),
    updatedAt: subDays(now, 5).toISOString(),
    estimatedDelivery: subDays(now, 5).toISOString(),
    truckPlate: 'RVS 007 BK', driver: 'Sunday Adesanya',
    driverPhone: '+234 806 443 2211',
    wayBillNo: 'WB-2026-1089',
    notes: '',
  },
  {
    id: 'ORD-2026-0409', listingId: 'l3', depotId: 'd4',
    depotName: 'Atlas Depot & Logistics', product: 'AGO',
    volume: 66_000, pricePerLitre: 1_140,
    totalValue: 66_000 * 1_140,
    status: 'delivered', state: 'Delta',
    createdAt: subDays(now, 15).toISOString(),
    updatedAt: subDays(now, 12).toISOString(),
    estimatedDelivery: subDays(now, 12).toISOString(),
    truckPlate: 'DLT 774 CK', driver: 'Chukwuemeka Nwosu',
    driverPhone: '+234 808 229 0011',
    wayBillNo: 'WB-2026-1071',
    notes: 'Double trip. Second truck LND 882 BB.',
  },
  {
    id: 'ORD-2026-0431', listingId: 'l4', depotId: 'd3',
    depotName: 'Northern Fuel Associates', product: 'PMS',
    volume: 33_000, pricePerLitre: 878,
    totalValue: 33_000 * 878,
    status: 'confirmed', state: 'Kaduna',
    createdAt: subMinutes(now, 45).toISOString(),
    updatedAt: subMinutes(now, 30).toISOString(),
    estimatedDelivery: subDays(now, -3).toISOString(),
    truckPlate: null, driver: null, driverPhone: null,
    wayBillNo: null,
    notes: 'Awaiting truck assignment.',
  },
  {
    id: 'ORD-2026-0418', listingId: 'l6', depotId: 'd1',
    depotName: 'Pinnacle Energy Depot', product: 'DPK',
    volume: 33_000, pricePerLitre: 610,
    totalValue: 33_000 * 610,
    status: 'pending', state: 'Lagos',
    createdAt: subHours(now, 1).toISOString(),
    updatedAt: subHours(now, 1).toISOString(),
    estimatedDelivery: subDays(now, -2).toISOString(),
    truckPlate: null, driver: null, driverPhone: null,
    wayBillNo: null,
    notes: '',
  },
  {
    id: 'ORD-2026-0388', listingId: 'l3', depotId: 'd4',
    depotName: 'Atlas Depot & Logistics', product: 'AGO',
    volume: 33_000, pricePerLitre: 1_135,
    totalValue: 33_000 * 1_135,
    status: 'cancelled', state: 'Delta',
    createdAt: subDays(now, 20).toISOString(),
    updatedAt: subDays(now, 19).toISOString(),
    estimatedDelivery: subDays(now, 17).toISOString(),
    truckPlate: null, driver: null, driverPhone: null,
    wayBillNo: null,
    notes: 'Buyer cancelled — insufficient funds.',
  },
];

// ── Price History (30-day rolling window) ─────────────────────────
function genPriceHistory(base, volatility = 0.02, days = 30) {
  const pts = [];
  let price = base;
  for (let i = days; i >= 0; i--) {
    const d = subDays(now, i);
    price = price * (1 + (Math.random() - 0.48) * volatility);
    pts.push({
      date: format30(d),
      price: Math.round(price),
    });
  }
  return pts;
}

function format30(d) {
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1)
    .toString()
    .padStart(2, '0')}`;
}

export const PRICE_HISTORY = {
  PMS: genPriceHistory(860, 0.015),
  AGO: genPriceHistory(1_130, 0.018),
  DPK: genPriceHistory(595, 0.012),
  LPG: genPriceHistory(610, 0.02),
  ATK: genPriceHistory(1_280, 0.022),
};

// ── Volume traded per day (last 14 days) ──────────────────────────
export const VOLUME_HISTORY = Array.from({ length: 14 }, (_, i) => ({
  date: format30(subDays(now, 13 - i)),
  PMS: Math.round(300_000 + Math.random() * 200_000),
  AGO: Math.round(200_000 + Math.random() * 150_000),
  DPK: Math.round(80_000 + Math.random() * 60_000),
}));

// ── Market Summary ─────────────────────────────────────────────────
export const MARKET_SUMMARY = {
  PMS: { current: 872, prev: 858, low24h: 865, high24h: 880 },
  AGO: { current: 1_150, prev: 1_138, low24h: 1_140, high24h: 1_165 },
  DPK: { current: 610, prev: 618, low24h: 605, high24h: 615 },
  LPG: { current: 620, prev: 612, low24h: 615, high24h: 628 },
  ATK: { current: 1_295, prev: 1_280, low24h: 1_285, high24h: 1_305 },
};

// ── Notifications ──────────────────────────────────────────────────
export const NOTIFICATIONS = [
  {
    id: 'n1', type: 'order', read: false,
    title: 'Order In Transit',
    body: 'ORD-2026-0421 (PMS, 33kL) is now in transit. ETA tomorrow.',
    createdAt: subHours(now, 6).toISOString(),
  },
  {
    id: 'n2', type: 'price', read: false,
    title: 'PMS Price Alert',
    body: 'PMS price rose 1.6% in the last 2 hours across Lagos depots.',
    createdAt: subHours(now, 2).toISOString(),
  },
  {
    id: 'n3', type: 'listing', read: false,
    title: 'New AGO Listing',
    body: 'Atlas Depot posted 750,000L AGO @ ₦1,145/L. Expires in 5 days.',
    createdAt: subHours(now, 8).toISOString(),
  },
  {
    id: 'n4', type: 'order', read: true,
    title: 'Order Confirmed',
    body: 'ORD-2026-0431 (PMS, 33kL) confirmed by Northern Fuel Associates.',
    createdAt: subMinutes(now, 30).toISOString(),
  },
  {
    id: 'n5', type: 'system', read: true,
    title: 'Identity Verification Complete',
    body: 'Your CAC documents have been verified. You now have full market access.',
    createdAt: subDays(now, 2).toISOString(),
  },
];

// ── Dashboard KPIs ─────────────────────────────────────────────────
export const DASHBOARD_STATS = {
  totalVolumeTraded: 5_412_000,       // litres this month
  totalValueTraded:  6_823_440_000,   // NGN this month
  activeListings:    47,
  activeOrders:      3,
  savedOnMarket:     12_800_000,      // NGN saved vs retail
  avgSettlementDays: 1.4,
  prevTotalVolume:   4_876_000,
  prevTotalValue:    6_102_000_000,
};
