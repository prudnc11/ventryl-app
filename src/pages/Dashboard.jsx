import { Link } from 'react-router-dom';
import { Card, CardHeader, Stat } from '../components/ui/Card';
import { StatusBadge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { VolumeChart } from '../components/charts/VolumeChart';
import { useAppStore } from '../store/useAppStore';
import { MARKET_SUMMARY, VOLUME_HISTORY, DASHBOARD_STATS } from '../lib/data';
import { FUEL_TYPES, ORDER_STATUS } from '../lib/constants';
import { pct, timeAgo } from '../lib/utils';

const TICKER_PRODUCTS = ['PMS', 'AGO', 'DPK', 'LPG', 'ATK'];

function PriceTicker() {
  return (
    <div className="bg-[#0A2540] rounded-xl p-4 flex flex-wrap gap-6">
      {TICKER_PRODUCTS.map((p) => {
        const { current, prev } = MARKET_SUMMARY[p];
        const delta = pct(current, prev);
        const positive = delta >= 0;
        return (
          <div key={p} className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
              style={{ backgroundColor: FUEL_TYPES[p].color }}
            >
              {p}
            </div>
            <div>
              <p className="text-[10px] text-white/40 uppercase tracking-wide">{FUEL_TYPES[p].short}</p>
              <p className="text-sm font-bold text-white">₦{current.toLocaleString()}/L</p>
            </div>
            <span className={`text-xs font-semibold ${positive ? 'text-emerald-400' : 'text-red-400'}`}>
              {positive ? '+' : ''}{delta}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

function RecentOrders({ orders }) {
  return (
    <Card>
      <CardHeader
        title="Recent Orders"
        subtitle={`${orders.length} total`}
        action={<Link to="/orders" className="text-xs text-blue-600 hover:underline">View all →</Link>}
      />
      <div className="space-y-3">
        {orders.slice(0, 4).map((order) => (
          <div
            key={order.id}
            className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0"
          >
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                style={{ backgroundColor: FUEL_TYPES[order.product]?.color ?? '#6B7280' }}
              >
                {order.product}
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-900">{order.id}</p>
                <p className="text-xs text-gray-400">{order.depotName} · {(order.volume / 1000).toFixed(0)}kL</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge status={order.status} map={ORDER_STATUS} />
              <span className="text-xs text-gray-400 hidden sm:block">{timeAgo(order.updatedAt)}</span>
            </div>
          </div>
        ))}
        {orders.length === 0 && (
          <p className="text-sm text-gray-400 py-4 text-center">No orders yet.</p>
        )}
      </div>
    </Card>
  );
}

function ActiveListingsPreview({ listings }) {
  const active = listings.filter((l) => l.status === 'active').slice(0, 4);
  return (
    <Card>
      <CardHeader
        title="Hot Listings"
        subtitle="Most bids in last 24 hours"
        action={<Link to="/market" className="text-xs text-blue-600 hover:underline">Browse all →</Link>}
      />
      <div className="space-y-3">
        {active.map((l) => (
          <div key={l.id} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                style={{ backgroundColor: FUEL_TYPES[l.product]?.color ?? '#6B7280' }}
              >
                {l.product}
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-900">{l.depotName}</p>
                <p className="text-xs text-gray-400">{l.state} · {(l.volume / 1_000_000).toFixed(2)}ML available</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs font-bold text-gray-900">₦{l.pricePerLitre.toLocaleString()}/L</p>
              <p className="text-[10px] text-gray-400">{l.bids} bid{l.bids !== 1 ? 's' : ''}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function Dashboard() {
  const { orders, listings } = useAppStore();
  const s = DASHBOARD_STATS;
  const volumePct = pct(s.totalVolumeTraded, s.prevTotalVolume);
  const valuePct  = pct(s.totalValueTraded,  s.prevTotalValue);

  return (
    <div className="space-y-6">
      {/* Price Ticker */}
      <PriceTicker />

      {/* KPI Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat
          label="Volume Traded (MTD)"
          value={`${(s.totalVolumeTraded / 1_000_000).toFixed(2)}ML`}
          change={volumePct}
          changeLabel="vs last month"
          color="#0A2540"
          icon={
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3z" />
            </svg>
          }
        />
        <Stat
          label="Value Traded (MTD)"
          value={`₦${(s.totalValueTraded / 1_000_000_000).toFixed(2)}B`}
          change={valuePct}
          changeLabel="vs last month"
          color="#F59E0B"
          icon={
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
            </svg>
          }
        />
        <Stat
          label="Active Listings"
          value={s.activeListings}
          color="#3B82F6"
          icon={
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5 5a3 3 0 015-2.236A3 3 0 0114.83 6H16a2 2 0 110 4h-5V9a1 1 0 10-2 0v1H4a2 2 0 110-4h1.17C5.06 5.687 5 5.35 5 5zm4 1V5a1 1 0 10-1 0v1H5a1 1 0 000 2h9a1 1 0 100-2h-5z" clipRule="evenodd" />
              <path d="M9 11H3v5a2 2 0 002 2h4v-7zM11 18h4a2 2 0 002-2v-5h-6v7z" />
            </svg>
          }
        />
        <Stat
          label="Savings vs Retail"
          value={`₦${(s.savedOnMarket / 1_000_000).toFixed(1)}M`}
          color="#10B981"
          icon={
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd" />
            </svg>
          }
        />
      </div>

      {/* Charts + Quick Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader title="Daily Volume Traded" subtitle="Last 14 days (PMS, AGO, DPK)" />
            <VolumeChart data={VOLUME_HISTORY} stacked />
          </Card>
        </div>
        <div className="space-y-4">
          <Card>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Quick Actions</p>
            <div className="space-y-2">
              <Link to="/market">
                <Button variant="primary" className="w-full justify-start" size="sm"
                  icon={<svg viewBox="0 0 20 20" fill="currentColor"><path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3z" /></svg>}
                >
                  Browse Listings
                </Button>
              </Link>
              <Link to="/priceboard">
                <Button variant="outline" className="w-full justify-start" size="sm"
                  icon={<svg viewBox="0 0 20 20" fill="currentColor"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" /></svg>}
                >
                  Check Prices
                </Button>
              </Link>
              <Link to="/depots">
                <Button variant="outline" className="w-full justify-start" size="sm"
                  icon={<svg viewBox="0 0 20 20" fill="currentColor"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" /></svg>}
                >
                  Find Depots
                </Button>
              </Link>
            </div>
          </Card>
          <Card>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Avg. Settlement</p>
            <p className="text-2xl font-bold text-gray-900">{s.avgSettlementDays} days</p>
            <p className="text-xs text-gray-400 mt-0.5">from order to delivery</p>
          </Card>
        </div>
      </div>

      {/* Recent Orders + Active Listings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RecentOrders orders={orders} />
        <ActiveListingsPreview listings={listings} />
      </div>
    </div>
  );
}
