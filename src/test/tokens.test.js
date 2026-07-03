import { describe, it, expect } from 'vitest';
import { T, F, GLOBAL_STYLES } from '../lib/tokens';

describe('design tokens', () => {
  it('exports T with all required colour keys', () => {
    const required = ['black', 'white', 'green', 'greenLight', 'greenDark',
      'gray50', 'gray100', 'gray200', 'gray400', 'gray600', 'gray800',
      'red', 'redLight', 'amber', 'amberLight', 'blue', 'blueLight'];
    for (const key of required) {
      expect(T).toHaveProperty(key);
      expect(T[key]).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('exports F as a string font family', () => {
    expect(typeof F).toBe('string');
    expect(F).toContain('Manrope');
  });

  it('exports GLOBAL_STYLES as a non-empty string', () => {
    expect(typeof GLOBAL_STYLES).toBe('string');
    expect(GLOBAL_STYLES.length).toBeGreaterThan(50);
    expect(GLOBAL_STYLES).toContain('box-sizing');
  });
});
