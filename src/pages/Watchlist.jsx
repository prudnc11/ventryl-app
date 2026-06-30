import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { VerifiedBadge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { useAppStore } from '../store/useAppStore';
import { FUEL_TYPES } from '../lib/constants';
import { formatDate } from '../lib/utils';

export function Watchlist() {
  const { listings, watchlist, toggleWatchlist } = useAppStore();
  const saved = useMemo(() => listings.filter((l) => watchlist.includes(l.id)), [listings, watchlist]);

  if (saved.length === 0) {
    return (
      <EmptyState
        title="Your watchlist is empty"
        description="Save listings from the Marketplace to track them here."
        icon={
          <svg className="w-8 h-8" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
          </svg>
        }
        action={<Link to="/market"><Button>Browse Marketplace</Button></Link>}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          <span className="font-semibold text-gray-900">{saved.length}</span> saved listing{saved.length !== 1 ? 's' : ''}
        </p>
        <Link to="/market">
          <Button variant="outline" size="sm">Browse more</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {saved.map((l) => {
          const fuel = FUEL_TYPES[l.product];
          return (
            <Card key={l.id} className="hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold text-white"
                    style={{ backgroundColor: fuel?.color }}
                  >{l.product}</div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{fuel?.label}</p>
                    <p className="text-xs text-gray-400">{l.depotName}</p>
                  </div>
                </div>
                <button
                  onClick={() => toggleWatchlist(l.id)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-red-400 hover:bg-red-50"
                >
                  <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="bg-gray-50 rounded-lg p-2">
                  <p className="text-[10px] text-gray-400">Price/L</p>
                  <p className="text-sm font-bold text-gray-900">₦{l.pricePerLitre.toLocaleString()}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-2">
                  <p className="text-[10px] text-gray-400">Available</p>
                  <p className="text-sm font-bold text-gray-900">{(l.volume / 1_000_000).toFixed(2)}ML</p>
                </div>
              </div>
              <div className="text-xs text-gray-400 flex items-center justify-between mb-3">
                <span>{l.state}</span>
                <span>Exp: {formatDate(l.expiresAt)}</span>
              </div>
              {l.verified && <VerifiedBadge />}
              <div className="mt-3">
                <Link to="/market">
                  <Button size="sm" className="w-full">Place Order</Button>
                </Link>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
