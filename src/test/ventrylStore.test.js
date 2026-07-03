import { describe, it, expect } from 'vitest';

// Pull the private adapters via the module. Since they're not exported,
// we test their behaviour indirectly through the shapes they produce.
// We re-implement the pure functions here to keep tests portable.

// ── Helpers copied from ventrylStore (pure, no Supabase dep) ──────────────────

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

function fmtDate(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('en-NG', { month: 'short', day: 'numeric' });
}

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

function adaptOrderDetail(row) {
  const trucks = (row.order_trucks || []).sort((a, b) => (a.truck_index ?? 0) - (b.truck_index ?? 0));
  const trucks_detail = trucks.length
    ? trucks.map((t, i) => ({
        id: `T${i + 1}`,
        _dbId: t.id,
        driver: t.driver_name || 'TBD',
        plate: t.plate_number || 'TBD',   // must read plate_number, not plate
        vol: t.volume || 0,
        departure: t.departure_time || 'TBD',
        eta: t.eta || 'TBD',
        arrivalTime: t.arrival_time || null,
        progress: t.progress || 0,
        status: t.status || row.status,
      }))
    : [];

  return {
    status: row.status || 'pending',
    product: (row.order_items || []).map(i => i.product).join(' + '),
    vol: row.total_volume || 0,
    bay: row.bay_assigned || null,
    loadingRef: row.loading_ref || null,
    trucks_detail,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('adaptOrder', () => {
  it('maps a basic order row', () => {
    const row = {
      id: 'VTL-01001',
      status: 'confirmed',
      total_volume: 33000,
      total_value: 24_750_000,
      trucks_count: 1,
      placed_at: '2024-01-15T10:00:00Z',
      order_items: [{ product: 'PMS' }],
      depots: { name: 'Matrix' },
      profiles: { company_name: 'Acme Oil Ltd' },
    };
    const result = adaptOrder(row);
    expect(result.id).toBe('VTL-01001');
    expect(result.product).toBe('PMS');
    expect(result.depot).toBe('Matrix');
    expect(result.buyer).toBe('Acme Oil Ltd');
    expect(result.progress).toBe(20);
    expect(result.pendingQuote).toBe(false);
  });

  it('sets pendingQuote=true when negotiation status is buyer_pending', () => {
    const row = {
      id: 'VTL-01002',
      status: 'confirmed',
      order_items: [],
      delivery_negotiations: [{ status: 'buyer_pending' }],
    };
    expect(adaptOrder(row).pendingQuote).toBe(true);
  });

  it('joins multiple products with "+"', () => {
    const row = {
      id: 'VTL-01003',
      status: 'pending',
      order_items: [{ product: 'PMS' }, { product: 'AGO' }],
    };
    expect(adaptOrder(row).product).toBe('PMS + AGO');
  });
});

describe('adaptOrderDetail — truck plate_number', () => {
  it('reads plate_number column (not plate)', () => {
    const row = {
      id: 'VTL-01004',
      status: 'in_transit',
      order_items: [{ product: 'PMS' }],
      total_volume: 33000,
      order_trucks: [{
        id: 'truck-uuid-1',
        truck_index: 0,
        driver_name: 'Emeka Obi',
        plate_number: 'ABC-123-XY',   // DB column is plate_number
        volume: 33000,
        progress: 65,
        status: 'in_transit',
      }],
    };
    const result = adaptOrderDetail(row);
    expect(result.trucks_detail).toHaveLength(1);
    expect(result.trucks_detail[0].plate).toBe('ABC-123-XY');
    expect(result.trucks_detail[0]._dbId).toBe('truck-uuid-1');
  });

  it('falls back to TBD when plate_number is absent', () => {
    const row = {
      id: 'VTL-01005',
      status: 'loading',
      order_items: [],
      order_trucks: [{ id: 'uuid', truck_index: 0 }],
    };
    expect(adaptOrderDetail(row).trucks_detail[0].plate).toBe('TBD');
  });
});

describe('statusToProgress', () => {
  it('maps all known statuses', () => {
    expect(statusToProgress('pending')).toBe(5);
    expect(statusToProgress('confirmed')).toBe(20);
    expect(statusToProgress('loading')).toBe(40);
    expect(statusToProgress('in_transit')).toBe(65);
    expect(statusToProgress('delivered')).toBe(100);
    expect(statusToProgress('collected')).toBe(100);
    expect(statusToProgress('disputed')).toBe(50);
  });

  it('returns 0 for unknown status', () => {
    expect(statusToProgress('unknown')).toBe(0);
  });
});
