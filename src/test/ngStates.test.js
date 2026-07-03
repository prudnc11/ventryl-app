import { describe, it, expect } from 'vitest';
import { NG_STATES } from '../lib/ngStates';

describe('NG_STATES', () => {
  it('contains all 36 states + FCT', () => {
    const keys = Object.keys(NG_STATES);
    expect(keys.length).toBe(37);
    expect(keys).toContain('Lagos');
    expect(keys).toContain('FCT');
    expect(keys).toContain('Rivers');
  });

  it('each state has at least one LGA', () => {
    for (const [state, lgas] of Object.entries(NG_STATES)) {
      expect(Array.isArray(lgas)).toBe(true);
      expect(lgas.length).toBeGreaterThan(0);
    }
  });

  it('Lagos has 20 LGAs', () => {
    expect(NG_STATES['Lagos']).toHaveLength(20);
  });

  it('FCT has 6 area councils', () => {
    expect(NG_STATES['FCT']).toHaveLength(6);
  });
});
