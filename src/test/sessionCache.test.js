import { describe, it, expect, beforeEach } from 'vitest';
import {
  _deliveryQuoteStore,
  _orderStatusStore,
  _orderBayStore,
  _orderTruckListStore,
  _orderDispatchedStore,
  _orderStatusLogStore,
  _gateRecordStore,
  _buyerConfirmedStore,
} from '../lib/sessionCache';

describe('sessionCache', () => {
  it('exports all 8 cache objects', () => {
    expect(_deliveryQuoteStore).toBeTypeOf('object');
    expect(_orderStatusStore).toBeTypeOf('object');
    expect(_orderBayStore).toBeTypeOf('object');
    expect(_orderTruckListStore).toBeTypeOf('object');
    expect(_orderDispatchedStore).toBeTypeOf('object');
    expect(_orderStatusLogStore).toBeTypeOf('object');
    expect(_gateRecordStore).toBeTypeOf('object');
    expect(_buyerConfirmedStore).toBeTypeOf('object');
  });

  it('can be written and read synchronously (module-scope persistence)', () => {
    _orderStatusStore['VTL-99999'] = 'in_transit';
    expect(_orderStatusStore['VTL-99999']).toBe('in_transit');

    _deliveryQuoteStore['VTL-99999'] = { status: 'agreed', rounds: [{ from: 'depot', amount: 90000 }] };
    expect(_deliveryQuoteStore['VTL-99999'].status).toBe('agreed');
    expect(_deliveryQuoteStore['VTL-99999'].rounds).toHaveLength(1);
  });

  it('is the same reference across imports (module singleton)', async () => {
    const mod1 = await import('../lib/sessionCache');
    const mod2 = await import('../lib/sessionCache');
    expect(mod1._orderStatusStore).toBe(mod2._orderStatusStore);
  });
});
