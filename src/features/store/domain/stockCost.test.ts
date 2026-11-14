import { describe, expect, it } from 'vitest';
import { completeCost, consumeFifo, parsePurchaseCost, validatePurchaseCost } from './stockCost';

describe('purchase costs', () => {
  it('distinguishes explicit zero from missing and rejects rounding or unsafe amounts', () => {
    expect(parsePurchaseCost('0')).toBe(0);
    expect(parsePurchaseCost('1,23')).toBe(123);
    expect(parsePurchaseCost('')).toBeNull();
    expect(parsePurchaseCost('1.234')).toBeNull();
    expect(parsePurchaseCost('-1')).toBeNull();
    expect(parsePurchaseCost('1e2')).toBeNull();
    expect(parsePurchaseCost('9007199254740991')).toBeNull();
    expect(validatePurchaseCost(0, 10)).toBe(0);
    expect(validatePurchaseCost(undefined, 10)).toBeNull();
    expect(() => validatePurchaseCost(0.5, 2)).toThrow();
    expect(() => validatePurchaseCost(Number.MAX_SAFE_INTEGER, 2)).toThrow();
  });

  it('never presents known partial purchase costs as a complete total', () => {
    expect(completeCost([0, 100, null])).toBeNull();
    const lots = [{ id: 1, remaining_units: 1, unit_cost_cents: null }, { id: 2, remaining_units: 2, unit_cost_cents: 200 }];
    expect(consumeFifo(lots, 2)).toBeNull();
    expect(consumeFifo(lots, 1)).toBe(200);
    expect(() => consumeFifo(lots, 1)).toThrow('no coincide');
  });
});
