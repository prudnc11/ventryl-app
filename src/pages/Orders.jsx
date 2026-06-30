import { useState, useMemo } from 'react';
import { Card, CardHeader } from '../components/ui/Card';
import { StatusBadge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import { useAppStore } from '../store/useAppStore';
import { FUEL_TYPES, ORDER_STATUS } from '../lib/constants';
import { timeAgo, formatDateTime, formatDate } from '../lib/utils';

function OrderTimeline({ order }) {
  const stages = [
    { key: 'pending',    label: 'Order Placed' },
    { key: 'confirmed',  label: 'Confirmed' },
    { key: 'loading',    label: 'Loading' },
    { key: 'in_transit', label: 'In Transit' },
    { key: 'delivered',  label: 'Delivered' },
  ];
  const keys = stages.map((s) => s.key);
  const currentIdx = keys.indexOf(order.status);
  const isCancelled = order.status === 'cancelled' || order.status === 'disputed';

  return (
    <div className="flex items-center gap-0 mt-4">
      {stages.map((s, i) => {
        const done = !isCancelled && i <= currentIdx;
        const active = !isCancelled && i === currentIdx;
        return (
          <div key={s.key} className="flex-1 flex flex-col items-center">
            <div className="flex items-center w-full">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 z-10 text-xs font-bold border-2 transition-colors
                  ${active ? 'bg-[#0A2540] border-[#0A2540] text-white' : done ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white border-gray-300 text-gray-400'}`}
              >
                {done && !active ? '✓' : i + 1}
              </div>
              {i < stages.length - 1 && (
                <div className={`flex-1 h-0.5 ${done && !active ? 'bg-emerald-500' : 'bg-gray-200'}`} />
              )}
            </div>
            <p className={`text-[9px] mt-1 text-center font-medium ${active ? 'text-[#0A2540]' : done ? 'text-emerald-600' : 'text-gray-400'}`}>
              {s.label}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function OrderDetailModal({ order, open, onClose }) {
  if (!order) return null;
  const fuel = FUEL_TYPES[order.product];

  return (
    <Modal open={open} onClose={onClose} title={`Order ${order.id}`} size="lg">
      <div className="space-y-5">
        {/* Status + product */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white"
              style={{ backgroundColor: fuel?.color ?? '#6B7280' }}
            >
              {order.product}
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">{fuel?.label}</p>
              <p className="text-xs text-gray-400">{order.depotName} · {order.state}</p>
            </div>
          </div>
          <StatusBadge status={order.status} map={ORDER_STATUS} />
        </div>

        {/* Timeline */}
        <OrderTimeline order={order} />

        {/* Details grid */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Volume</p>
            <p className="font-semibold text-gray-900">{order.volume.toLocaleString()} L</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Price per Litre</p>
            <p className="font-semibold text-gray-900">₦{order.pricePerLitre.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Total Value</p>
            <p className="font-bold text-[#0A2540] text-base">₦{order.totalValue.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Est. Delivery</p>
            <p className="font-semibold text-gray-900">{formatDate(order.estimatedDelivery)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Order Placed</p>
            <p className="font-medium text-gray-700">{formatDateTime(order.createdAt)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Last Updated</p>
            <p className="font-medium text-gray-700">{formatDateTime(order.updatedAt)}</p>
          </div>
        </div>

        {/* Waybill / Truck */}
        {order.wayBillNo && (
          <div className="bg-gray-50 rounded-xl p-4 space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Logistics</p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-gray-400">Waybill No.</p>
                <p className="font-semibold text-gray-900">{order.wayBillNo}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Truck Plate</p>
                <p className="font-semibold text-gray-900">{order.truckPlate ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Driver</p>
                <p className="font-semibold text-gray-900">{order.driver ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Driver Phone</p>
                <p className="font-semibold text-gray-900">{order.driverPhone ?? '—'}</p>
              </div>
            </div>
          </div>
        )}

        {order.notes && (
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
            <p className="text-xs font-semibold text-amber-700 mb-1">Notes</p>
            <p className="text-sm text-amber-900">{order.notes}</p>
          </div>
        )}
      </div>
    </Modal>
  );
}

export function Orders() {
  const { orders } = useAppStore();
  const [statusFilter, setStatusFilter] = useState('all');
  const [productFilter, setProductFilter] = useState('all');
  const [selected, setSelected] = useState(null);

  const ACTIVE_STATUSES = ['pending', 'confirmed', 'loading', 'in_transit'];

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (statusFilter === 'active') {
        if (!ACTIVE_STATUSES.includes(o.status)) return false;
      } else if (statusFilter !== 'all' && o.status !== statusFilter) return false;
      if (productFilter !== 'all' && o.product !== productFilter) return false;
      return true;
    });
  }, [orders, statusFilter, productFilter]);

  // Summary counts
  const counts = useMemo(() => ({
    all: orders.length,
    active: orders.filter((o) => ['pending', 'confirmed', 'loading', 'in_transit'].includes(o.status)).length,
    delivered: orders.filter((o) => o.status === 'delivered').length,
    cancelled: orders.filter((o) => o.status === 'cancelled').length,
  }), [orders]);

  const totalValue = useMemo(() =>
    filtered.reduce((sum, o) => sum + o.totalValue, 0), [filtered]);

  return (
    <div className="space-y-5">
      {/* Summary Tabs */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { key: 'all',       label: 'All Orders',   count: counts.all,       color: 'text-gray-900' },
          { key: 'active',    label: 'Active',        count: counts.active,    color: 'text-blue-600' },
          { key: 'delivered', label: 'Delivered',     count: counts.delivered, color: 'text-emerald-600' },
          { key: 'cancelled', label: 'Cancelled',     count: counts.cancelled, color: 'text-red-500' },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setStatusFilter(t.key)}
            className="bg-white rounded-xl border border-gray-200 p-4 text-left hover:shadow-sm transition-shadow"
          >
            <p className={`text-2xl font-bold ${t.color}`}>{t.count}</p>
            <p className="text-xs text-gray-500 mt-0.5">{t.label}</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <div className="flex flex-wrap gap-3 items-end">
          <Select
            label="Status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-44"
          >
            <option value="all">All Statuses</option>
            {Object.entries(ORDER_STATUS).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </Select>
          <Select
            label="Product"
            value={productFilter}
            onChange={(e) => setProductFilter(e.target.value)}
            className="w-40"
          >
            <option value="all">All Products</option>
            {Object.entries(FUEL_TYPES).map(([k, v]) => (
              <option key={k} value={k}>{v.short}</option>
            ))}
          </Select>
          <div className="ml-auto self-end bg-[#0A2540]/5 rounded-lg px-4 py-2">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Total Value</p>
            <p className="text-sm font-bold text-[#0A2540]">₦{totalValue.toLocaleString()}</p>
          </div>
        </div>
      </Card>

      {/* Orders List */}
      {filtered.length === 0 ? (
        <EmptyState
          title="No orders found"
          description="Your orders matching those filters will appear here."
          icon={<svg className="w-8 h-8" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" /></svg>}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((order) => (
            <button
              key={order.id}
              onClick={() => setSelected(order)}
              className="w-full text-left bg-white rounded-xl border border-gray-200 hover:shadow-md transition-shadow"
            >
              <div className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                      style={{ backgroundColor: FUEL_TYPES[order.product]?.color }}
                    >
                      {order.product}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{order.id}</p>
                      <p className="text-xs text-gray-400">{order.depotName} · {order.state}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-xs text-gray-400">Total Value</p>
                      <p className="text-sm font-bold text-gray-900">₦{order.totalValue.toLocaleString()}</p>
                    </div>
                    <StatusBadge status={order.status} map={ORDER_STATUS} />
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-gray-400">
                  <div className="flex gap-4">
                    <span>{order.volume.toLocaleString()} L</span>
                    <span>₦{order.pricePerLitre.toLocaleString()}/L</span>
                    {order.wayBillNo && <span>WB: {order.wayBillNo}</span>}
                  </div>
                  <span>{timeAgo(order.updatedAt)}</span>
                </div>

                {/* Mini timeline for active orders */}
                {['pending', 'confirmed', 'loading', 'in_transit'].includes(order.status) && (
                  <OrderTimeline order={order} />
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      <OrderDetailModal order={selected} open={!!selected} onClose={() => setSelected(null)} />
    </div>
  );
}
