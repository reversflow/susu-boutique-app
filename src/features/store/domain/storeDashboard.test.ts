import { describe, expect, it } from 'vitest';
import { calculateStoreDashboard } from './storeDashboard';
import { StoreStockItem } from './types';

const stock: StoreStockItem[] = [{ id: 1, categoryId: 1, categoryName: 'Collares', priceCents: 500, stockUnits: 3, sortOrder: 0, photoDataUrl: '', inventoryCostCents: 600 }];

describe('store dashboard', () => {
  it('uses charged sales and remaining inventory to calculate recovery and forecast', () => {
    expect(calculateStoreDashboard(stock, { unitsSold: 2, revenueCents: 600, soldCostCents: 400 })).toEqual({
      remaining: 3, total: 5, percentRemaining: 60, investment: 1000,
      inventoryCost: 600, projectedRevenue: 2100, recoveryPercent: 60,
      missingInvestment: 400, realizedGross: 200, projectedGross: 1100,
    });
  });
  it('keeps investment and forecast pending if any cost is unknown', () => {
    const result = calculateStoreDashboard([{ ...stock[0], inventoryCostCents: null }], { unitsSold: 1, revenueCents: 300, soldCostCents: 200 });
    expect(result.investment).toBeNull();
    expect(result.recoveryPercent).toBeNull();
    expect(result.projectedGross).toBeNull();
    expect(result.realizedGross).toBe(100);
    expect(calculateStoreDashboard(stock, { unitsSold: 1, revenueCents: 300, soldCostCents: null }).realizedGross).toBeNull();
  });
  it('shows no percentage without units and detects recovered investment', () => {
    expect(calculateStoreDashboard([], { unitsSold: 0, revenueCents: 0, soldCostCents: 0 }).percentRemaining).toBeNull();
    expect(calculateStoreDashboard(stock, { unitsSold: 2, revenueCents: 1200, soldCostCents: 400 }).missingInvestment).toBe(0);
    expect(calculateStoreDashboard(stock, { unitsSold: 2, revenueCents: 1200, soldCostCents: 400 }).recoveryPercent).toBe(100);
  });

  it('rejects dashboard totals that cannot be represented safely', () => {
    expect(() => calculateStoreDashboard(
      [{ ...stock[0], stockUnits: Number.MAX_SAFE_INTEGER }],
      { unitsSold: 1, revenueCents: 0, soldCostCents: 0 },
    )).toThrow('El coste supera el límite permitido.');
  });
});
