import { describe, expect, it } from 'vitest';
import { normalizeSale, parseSalePrice } from './salePricing';

describe('sale pricing', () => {
  it('parses decimal cents without accepting truncated or ambiguous input', () => {
    expect(parseSalePrice('3,00')).toBe(300);
    expect(parseSalePrice('0.01')).toBe(1);
    expect(parseSalePrice(' 5 ')).toBe(500);
    for (const value of ['', '0', '-3', '1e2', '3.001', '3,1x', '1.000,00', '9007199254740991']) {
      expect(parseSalePrice(value)).toBeNull();
    }
  });

  it('accepts mixed base/agreed lines and rejects invalid carts', () => {
    expect(normalizeSale({ requestId: 'cart-123456', items: [
      { priceGroupId: 1, units: 1 }, { priceGroupId: 2, units: 2, unitPriceCents: 300 },
    ] }).items).toHaveLength(2);
    expect(() => normalizeSale({ requestId: 'short', items: [] })).toThrow();
    expect(() => normalizeSale({ requestId: 'cart-123456', items: [{ priceGroupId: 1, units: 1.5 }] })).toThrow();
  });
});
