import { useState, useMemo } from 'react';
import { Card, CardHeader } from '../components/ui/Card';
import { Badge, VerifiedBadge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input, Select } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import { useAppStore } from '../store/useAppStore';
import { FUEL_TYPES, NIGERIAN_STATES, DEPOT_TIERS } from '../lib/constants';

function StarRating({ rating }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <svg
          key={n}
          className={`w-3.5 h-3.5 ${n <= Math.round(rating) ? 'text-amber-400' : 'text-gray-200'}`}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
      <span className="text-xs font-medium text-gray-600 ml-1">{rating.toFixed(1)}</span>
    </div>
  );
}

function DepotModal({ depot, open, onClose }) {
  if (!depot) return null;
  const tier = DEPOT_TIERS[depot.tier];

  return (
    <Modal open={open} onClose={onClose} title={depot.name} size="lg">
      <div className="space-y-5">
        {/* Header info */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ color: tier?.color, backgroundColor: `${tier?.color}15` }}
              >
                {tier?.label}
              </span>
              {depot.verified && <VerifiedBadge />}
            </div>
            <p className="text-sm text-gray-500">{depot.address}</p>
          </div>
          <StarRating rating={depot.rating} />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Capacity', value: `${(depot.capacity / 1_000_000).toFixed(1)}ML` },
            { label: 'Total Trades', value: depot.totalTrades },
            { label: 'Rating', value: `${depot.rating}/5.0` },
          ].map(({ label, value }) => (
            <div key={label} className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-[#0A2540]">{value}</p>
              <p className="text-[10px] text-gray-400 uppercase tracking-wide mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Products */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Available Products</p>
          <div className="flex flex-wrap gap-2">
            {depot.products.map((p) => (
              <span
                key={p}
                className="px-3 py-1.5 rounded-full text-xs font-bold text-white"
                style={{ backgroundColor: FUEL_TYPES[p]?.color }}
              >
                {FUEL_TYPES[p]?.label}
              </span>
            ))}
          </div>
        </div>

        {/* Contact */}
        <div className="bg-[#0A2540] rounded-xl p-4">
          <p className="text-xs font-semibold text-white/50 uppercase tracking-wide mb-3">Contact</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-white/40">Phone</p>
              <p className="text-sm font-semibold text-white">{depot.contact}</p>
            </div>
            <div>
              <p className="text-xs text-white/40">Email</p>
              <p className="text-sm font-semibold text-white">{depot.email}</p>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <Button className="flex-1">Request Quote</Button>
          <Button variant="outline" className="flex-1">View Listings</Button>
        </div>
      </div>
    </Modal>
  );
}

function DepotCard({ depot, onClick }) {
  const tier = DEPOT_TIERS[depot.tier];
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold text-gray-900">{depot.name}</h3>
            {depot.verified && (
              <svg className="w-4 h-4 text-blue-500 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
              </svg>
            )}
          </div>
          <p className="text-xs text-gray-400">{depot.state} · {depot.address.split(',')[0]}</p>
        </div>
        <span
          className="text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
          style={{ color: tier?.color, backgroundColor: `${tier?.color}15` }}
        >
          {tier?.label}
        </span>
      </div>

      <StarRating rating={depot.rating} />

      <div className="grid grid-cols-2 gap-2 mt-3 mb-3">
        <div className="bg-gray-50 rounded-lg p-2">
          <p className="text-[10px] text-gray-400">Capacity</p>
          <p className="text-sm font-bold text-gray-900">{(depot.capacity / 1_000_000).toFixed(1)}ML</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-2">
          <p className="text-[10px] text-gray-400">Trades</p>
          <p className="text-sm font-bold text-gray-900">{depot.totalTrades}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        {depot.products.map((p) => (
          <span
            key={p}
            className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white"
            style={{ backgroundColor: FUEL_TYPES[p]?.color }}
          >
            {p}
          </span>
        ))}
      </div>
    </button>
  );
}

export function Depots() {
  const { depots } = useAppStore();
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('all');
  const [productFilter, setProductFilter] = useState('all');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [selected, setSelected] = useState(null);

  const filtered = useMemo(() => {
    return depots.filter((d) => {
      if (stateFilter !== 'all' && d.state !== stateFilter) return false;
      if (productFilter !== 'all' && !d.products.includes(productFilter)) return false;
      if (verifiedOnly && !d.verified) return false;
      if (search && !d.name.toLowerCase().includes(search.toLowerCase()) && !d.state.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [depots, search, stateFilter, productFilter, verifiedOnly]);

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <p className="text-2xl font-bold text-[#0A2540]">{depots.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Registered Depots</p>
        </Card>
        <Card>
          <p className="text-2xl font-bold text-emerald-600">{depots.filter((d) => d.tier === 'certified').length}</p>
          <p className="text-xs text-gray-500 mt-0.5">DPR Certified</p>
        </Card>
        <Card>
          <p className="text-2xl font-bold text-blue-600">{depots.filter((d) => d.verified).length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Verified</p>
        </Card>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <Input
            label="Search"
            placeholder="Depot name, state…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-52"
            leading={<svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" /></svg>}
          />
          <Select label="State" value={stateFilter} onChange={(e) => setStateFilter(e.target.value)} className="w-44">
            <option value="all">All States</option>
            {NIGERIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
          <Select label="Product" value={productFilter} onChange={(e) => setProductFilter(e.target.value)} className="w-40">
            <option value="all">All Products</option>
            {Object.entries(FUEL_TYPES).map(([k, v]) => (
              <option key={k} value={k}>{v.short}</option>
            ))}
          </Select>
          <label className="flex items-center gap-2 cursor-pointer self-end pb-2">
            <input
              type="checkbox"
              checked={verifiedOnly}
              onChange={(e) => setVerifiedOnly(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-[#0A2540]"
            />
            <span className="text-sm text-gray-700 font-medium">Verified only</span>
          </label>
          <p className="ml-auto self-end pb-2 text-sm text-gray-400">
            <strong className="text-gray-900">{filtered.length}</strong> depot{filtered.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No depots found"
          description="Try adjusting your search or filters."
          icon={<svg className="w-8 h-8" viewBox="0 0 20 20" fill="currentColor"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" /></svg>}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((depot) => (
            <DepotCard key={depot.id} depot={depot} onClick={() => setSelected(depot)} />
          ))}
        </div>
      )}

      <DepotModal depot={selected} open={!!selected} onClose={() => setSelected(null)} />
    </div>
  );
}
