import { describe, it, expect } from 'vitest';
import { assertValidTransition } from '../lib/api';

describe('assertValidTransition (order state machine)', () => {
  it('allows valid transitions', () => {
    expect(() => assertValidTransition('pending', 'confirmed')).not.toThrow();
    expect(() => assertValidTransition('confirmed', 'loading')).not.toThrow();
    expect(() => assertValidTransition('loading', 'in_transit')).not.toThrow();
    expect(() => assertValidTransition('loading', 'collected')).not.toThrow();
    expect(() => assertValidTransition('in_transit', 'delivered')).not.toThrow();
    expect(() => assertValidTransition('in_transit', 'collected')).not.toThrow();
    expect(() => assertValidTransition('in_transit', 'disputed')).not.toThrow();
    expect(() => assertValidTransition('disputed', 'collected')).not.toThrow();
    expect(() => assertValidTransition('pending', 'cancelled')).not.toThrow();
    expect(() => assertValidTransition('confirmed', 'cancelled')).not.toThrow();
  });

  it('blocks invalid transitions', () => {
    expect(() => assertValidTransition('pending', 'in_transit')).toThrow();
    expect(() => assertValidTransition('pending', 'delivered')).toThrow();
    expect(() => assertValidTransition('collected', 'loading')).toThrow();
    expect(() => assertValidTransition('rejected', 'confirmed')).toThrow();
    expect(() => assertValidTransition('cancelled', 'loading')).toThrow();
    expect(() => assertValidTransition('delivered', 'loading')).toThrow();
  });

  it('allows no-op same-status transition', () => {
    expect(() => assertValidTransition('pending', 'pending')).not.toThrow();
    expect(() => assertValidTransition('collected', 'collected')).not.toThrow();
  });

  it('throws descriptive message listing allowed states', () => {
    expect(() => assertValidTransition('pending', 'delivered')).toThrowError(/confirmed|rejected|cancelled/);
  });
});
