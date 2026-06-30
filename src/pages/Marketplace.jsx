import { useState, useMemo } from 'react';
import { Card } from '../components/ui/Card';
import { Badge, VerifiedBadge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input, Select } from '../components/ui/Input';
import { EmptyState } from '../components/ui/EmptyState';
import { Modal } from '../components/ui/Modal';
import { useAppStore } from '../store/useAppStore';
import { FUEL_TYPES, NIGERIAN_STATES } from '../lib/constants';
import { formatDate } from '../lib/utils';
import { addDays } from 'date-fns';

function ListingCard({ listing, onBuy, onWatch, isWatched }) {
  const fuel = FUEL_TYPES[listing.product];
  const totalValue = listing.volume * listing.pricePerLitre;

  return (
    <Card className="hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
            style={{ backgroundColor: fuel?.color ?? '#6B7280' }}
          >
            {listing.product}
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">{fuel?.label}</p>
            <p className="text-xs text-gray-400">{listing.depotName}</p>
          </div>
        </div>
        <button
          onClick={() => onWatch(listing.id)}
          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
            isWatched ? 'text-red-500 bg-red-50' : 'text-gray-300 hover:text-gray-500 hover:bg-gray-50'
          }`}
          aria-label="Toggle watchlist"
        >
          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      {/* Price + Volume */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-[10px] text-gray-400 uppercase tracking-wide">Price / Litre</p>
          <p className="text-lg font-bold text-gray-900">₦{listing.pricePerLitre.toLocaleString()}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-[10px] text-gray-400 uppercase tracking-wide">Available</p>
          <p className="text-lg font-bold text-gray-900">{(listing.volume / 1_000_000).toFixed(2)}ML</p>
        </div>
      </div>

      {/* Meta */}
      <div className="space-y-1.5 mb-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-400">Min. Order</span>
          <span className="font-medium text-gray-700">{listing.minOrder.toLocaleString()} L</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-400">Location</span>
          <span className="font-medium text-gray-700">{listing.state}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-400">Payment</span>
          <span className="font-medium text-gray-700">{listing.paymentTerms}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-400">Delivery</span>
          <span className="font-medium text-gray-700">{listing.deliveryMode}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-400">Expires</span>
          <span className="font-medium text-gray-700">{formatDate(listing.expiresAt)}</span>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <div className="flex items-center gap-2">
          {listing.verified && <VerifiedBadge />}
          <span className="text-xs text-gray-400">{listing.bids} bid{listing.bids !== 1 ? 's' : ''}</span>
        </div>
        {listing.status === 'active' ? (
          <Button size="sm" onClick={() => onBuy(listing)}>Place Order</Button>
        ) : (
          <Badge color="gray">Closed</Badge>
        )}
      </div>
    </Card>
  );
}

function PlaceOrderModal({ listing, open, onClose, onConfirm }) {
  const [volume, setVolume] = useState(listing?.minOrder?.toString() ?? '');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  if (!listing) return null;
  const total = Number(volume) * listing.pricePerLitre;
  const valid = Number(volume) >= listing.minOrder && Number(volume) <= listing.volume;

  const handleConfirm = async () => {
    if (!valid) return;
    setLoading(true);
    await new Promise((r) => setTimeout(r, 800));
    onConfirm({ listing, volume: Number(volume), notes });
    setLoading(false);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Place Order"
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleConfirm} loading={loading} disabled={!valid}>
            Confirm Order
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Summary */}
        <div className="bg-gray-50 rounded-xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold text-white"
              style={{ backgroundColor: FUEL_TYPES[listing.product]?.color }}
            >
              {listing.product}
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">{FUEL_TYPES[listing.product]?.label}</p>
              <p className="text-xs text-gray-400">{listing.depotName} · {listing.state}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div><span className="text-gray-400">Price: </span><span className="font-semibold">₦{listing.pricePerLitre.toLocaleString()}/L</span></div>
            <div><span className="text-gray-400">Available: </span><span className="font-semibold">{listing.volume.toLocaleString()} L</span></div>
            <div><span className="text-gray-400">Min. Order: </span><span className="font-semibold">{listing.minOrder.toLocaleString()} L</span></div>
            <div><span className="text-gray-400">Payment: </span><span className="font-semibold">{listing.paymentTerms}</span></div>
          </div>
        </div>

        <Input
          label="Volume (litres)"
          type="number"
          min={listing.minOrder}
          max={listing.volume}
          value={volume}
          onChange={(e) => setVolume(e.target.value)}
          hint={`Min: ${listing.minOrder.toLocaleString()} L · Max: ${listing.volume.toLocaleString()} L`}
          error={volume && !valid ? `Volume must be between ${listing.minOrder.toLocaleString()} and ${listing.volume.toLocaleString()} L` : ''}
        />

        {/* Total */}
        {volume && valid && (
          <div className="bg-[#0A2540] rounded-xl p-4">
            <div className="flex justify-between text-sm">
              <span className="text-white/60">Volume</span>
              <span className="text-white font-medium">{Number(volume).toLocaleString()} L</span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-white/60">Price per Litre</span>
              <span className="text-white font-medium">₦{listing.pricePerLitre.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-base font-bold mt-3 pt-3 border-t border-white/10">
              <span className="text-white">Total Value</span>
              <span className="text-[#F59E0B]">₦{total.toLocaleString()}</span>
            </div>
          </div>
        )}

        <Input
          label="Notes (optional)"
          placeholder="Loading instructions, special requirements..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        <p className="text-xs text-gray-400">
          By placing this order, you agree to Ventryl's trading terms. The depot will confirm within 2 hours.
        </p>
      </div>
    </Modal>
  );
}

export function Marketplace() {
  const { listings, filters, setFilter, resetFilters, watchlist, toggleWatchlist, addOrder } = useAppStore();
  const [selectedListing, setSelectedListing] = useState(null);
  const [orderPlaced, setOrderPlaced] = useState(null);
  const [view, setView] = useState('grid'); // 'grid' | 'list'

  const filtered = useMemo(() => {
    return listings.filter((l) => {
      if (filters.product !== 'all' && l.product !== filters.product) return false;
      if (filters.state !== 'all' && l.state !== filters.state) return false;
      if (filters.verifiedOnly && !l.verified) return false;
      if (filters.minVolume && l.volume < Number(filters.minVolume)) return false;
      if (filters.maxPrice && l.pricePerLitre > Number(filters.maxPrice)) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        if (!l.depotName.toLowerCase().includes(q) && !l.product.toLowerCase().includes(q) && !l.state.toLowerCase().includes(q)) return false;
      }
      if (l.status !== 'active') return false;
      return true;
    });
  }, [listings, filters]);

  const handleConfirmOrder = ({ listing, volume, notes }) => {
    const id = `ORD-2026-0${Math.floor(Math.random() * 900 + 100)}`;
    const order = {
      id,
      listingId: listing.id,
      depotId: listing.depotId,
      depotName: listing.depotName,
      product: listing.product,
      volume,
      pricePerLitre: listing.pricePerLitre,
      totalValue: volume * listing.pricePerLitre,
      status: 'pending',
      state: listing.state,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      estimatedDelivery: addDays(new Date(), 3).toISOString(),
      truckPlate: null, driver: null, driverPhone: null, wayBillNo: null,
      notes,
    };
    addOrder(order);
    setOrderPlaced(order);
  };

  return (
    <div className="space-y-5">
      {/* Success toast */}
      {orderPlaced && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 bg-emerald-500 rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 text-white" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            <p className="text-sm font-medium text-emerald-800">
              Order <strong>{orderPlaced.id}</strong> placed successfully. The depot will confirm shortly.
            </p>
          </div>
          <button onClick={() => setOrderPlaced(null)} className="text-emerald-600 hover:text-emerald-800 text-xs">✕</button>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <Input
            label="Search"
            placeholder="Depot, product, state…"
            value={filters.search}
            onChange={(e) => setFilter('search', e.target.value)}
            className="w-48"
            leading={<svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" /></svg>}
          />
          <Select
            label="Product"
            value={filters.product}
            onChange={(e) => setFilter('product', e.target.value)}
            className="w-40"
          >
            <option value="all">All Products</option>
            {Object.entries(FUEL_TYPES).map(([k, v]) => (
              <option key={k} value={k}>{v.short}</option>
            ))}
          </Select>
          <Select
            label="State"
            value={filters.state}
            onChange={(e) => setFilter('state', e.target.value)}
            className="w-44"
          >
            <option value="all">All States</option>
            {NIGERIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
          <Input
            label="Max Price (₦/L)"
            type="number"
            placeholder="e.g. 1200"
            value={filters.maxPrice}
            onChange={(e) => setFilter('maxPrice', e.target.value)}
            className="w-40"
          />
          <label className="flex items-center gap-2 cursor-pointer self-end pb-2">
            <input
              type="checkbox"
              checked={filters.verifiedOnly}
              onChange={(e) => setFilter('verifiedOnly', e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-[#0A2540] focus:ring-[#0A2540]"
            />
            <span className="text-sm text-gray-700 font-medium">DPR Verified only</span>
          </label>
          <div className="ml-auto self-end">
            <Button variant="ghost" size="sm" onClick={resetFilters}>Clear filters</Button>
          </div>
        </div>
      </div>

      {/* Results Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          <span className="font-semibold text-gray-900">{filtered.length}</span> listing{filtered.length !== 1 ? 's' : ''} found
        </p>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setView('grid')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${view === 'grid' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
          >Grid</button>
          <button
            onClick={() => setView('list')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${view === 'list' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
          >List</button>
        </div>
      </div>

      {/* Listings */}
      {filtered.length === 0 ? (
        <EmptyState
          title="No listings match your filters"
          description="Try removing some filters or broadening your search."
          icon={<svg className="w-8 h-8" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 5a3 3 0 015-2.236A3 3 0 0114.83 6H16a2 2 0 110 4h-5V9a1 1 0 10-2 0v1H4a2 2 0 110-4h1.17C5.06 5.687 5 5.35 5 5zm4 1V5a1 1 0 10-1 0v1H5a1 1 0 000 2h9a1 1 0 100-2h-5z" clipRule="evenodd" /></svg>}
          action={<Button variant="outline" onClick={resetFilters}>Clear filters</Button>}
        />
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((l) => (
            <ListingCard
              key={l.id}
              listing={l}
              onBuy={setSelectedListing}
              onWatch={toggleWatchlist}
              isWatched={watchlist.includes(l.id)}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100">
              <tr>
                {['Product', 'Depot', 'State', 'Price/L', 'Volume', 'Min Order', 'Expires', 'Verified', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => (
                <tr key={l.id} className="border-b border-gray-50 hover:bg-gray-50/80 transition-colors">
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-md text-xs font-bold text-white" style={{ backgroundColor: FUEL_TYPES[l.product]?.color }}>{l.product}</span>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">{l.depotName}</td>
                  <td className="px-4 py-3 text-gray-500">{l.state}</td>
                  <td className="px-4 py-3 font-bold text-gray-900">₦{l.pricePerLitre.toLocaleString()}</td>
                  <td className="px-4 py-3 text-gray-700">{(l.volume / 1_000_000).toFixed(2)}ML</td>
                  <td className="px-4 py-3 text-gray-700">{l.minOrder.toLocaleString()} L</td>
                  <td className="px-4 py-3 text-gray-500">{formatDate(l.expiresAt)}</td>
                  <td className="px-4 py-3">{l.verified ? <VerifiedBadge /> : '—'}</td>
                  <td className="px-4 py-3">
                    <Button size="xs" onClick={() => setSelectedListing(l)}>Order</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <PlaceOrderModal
        key={selectedListing?.id}
        listing={selectedListing}
        open={!!selectedListing}
        onClose={() => setSelectedListing(null)}
        onConfirm={handleConfirmOrder}
      />
    </div>
  );
}
