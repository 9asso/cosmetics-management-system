import { describe, expect, it } from 'vitest';
import { integer, money } from './format';

describe('Moroccan business formatting', () => {
  it('formats whole quantities without decimals', () => {
    expect(integer.format(1250)).not.toContain('.00');
  });

  it('includes the MAD currency marker', () => {
    expect(money.format(42)).toContain('MAD');
  });
});
