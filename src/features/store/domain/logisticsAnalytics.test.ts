import { describe, expect, it } from 'vitest';
import { calculateLogisticsAnalytics, LogisticsMonthInput } from './logisticsAnalytics';
import { StoreStockItem } from './types';

function stockItem(overrides: Partial<StoreStockItem> & Pick<StoreStockItem, 'id'>): StoreStockItem {
  return {
    categoryId: 1,
    categoryName: 'Anillos',
    priceCents: 1000,
    stockUnits: 0,
    sortOrder: 0,
    photoDataUrl: '',
    inventoryCostCents: 0,
    ...overrides,
  };
}

const month: LogisticsMonthInput = {
  totalSold: 1000,
  totalInvested: 400,
  totalAdditionalExpenses: 100,
  grossProfit: 600,
  netProfit: 500,
  averageDailyNetProfit: 25,
  estimatedSalary: 300,
  trackedDays: 20,
  totalDataphoneSales: 400,
  daysInMonth: 30,
};

describe('calculateLogisticsAnalytics', () => {
  it('returns zeroed metrics when there is no data', () => {
    const result = calculateLogisticsAnalytics({
      stock: [],
      sales: { unitsSold: 0, revenueCents: 0, soldCostCents: null },
      month: null,
    });

    expect(result.stock.unitsAvailable).toBe(0);
    expect(result.stock.unitsTotal).toBe(0);
    expect(result.stock.sellThroughPercent).toBeNull();
    expect(result.stock.inventoryCostCents).toBe(0);
    expect(result.stock.averageSalePriceCents).toBeNull();
    expect(result.stock.topCategories).toEqual([]);
    expect(result.sales.grossCents).toBeNull();
    expect(result.sales.grossMarginPercent).toBeNull();
    expect(result.sales.recoveryPercent).toBeNull();
    expect(result.month.salesCents).toBe(0);
    expect(result.month.grossMarginPercent).toBeNull();
    expect(result.month.breakEvenSalesCents).toBeNull();
  });

  it('summarizes inventory, sell-through and realized margin', () => {
    const result = calculateLogisticsAnalytics({
      stock: [
        stockItem({ id: 1, stockUnits: 4, priceCents: 1000, inventoryCostCents: 2000 }),
        stockItem({ id: 2, stockUnits: 2, priceCents: 2000, inventoryCostCents: 2400 }),
        stockItem({ id: 3, categoryId: 2, categoryName: 'Collares', stockUnits: 0, priceCents: 5000, inventoryCostCents: 0 }),
      ],
      sales: { unitsSold: 6, revenueCents: 9000, soldCostCents: 5000 },
      month,
    });

    expect(result.stock.unitsAvailable).toBe(6);
    expect(result.stock.unitsSold).toBe(6);
    expect(result.stock.unitsTotal).toBe(12);
    expect(result.stock.sellThroughPercent).toBe(50);
    expect(result.stock.retailValueCents).toBe(8000);
    expect(result.stock.inventoryCostCents).toBe(4400);
    expect(result.stock.potentialMarginCents).toBe(3600);
    expect(result.stock.potentialMarginPercent).toBe(45);
    expect(result.stock.averageSalePriceCents).toBe(1333);
    expect(result.stock.lowStockGroups).toBe(3);
    expect(result.stock.outOfStockGroups).toBe(1);
    expect(result.stock.topCategories.map((category) => category.name)).toEqual(['Anillos', 'Collares']);

    expect(result.sales.grossCents).toBe(4000);
    expect(result.sales.grossMarginPercent).toBe(44);
    expect(result.sales.averageTicketCents).toBe(1500);
    expect(result.sales.recoveryPercent).toBe(96);
  });

  it('keeps cost-dependent values pending when a unit has no purchase cost', () => {
    const result = calculateLogisticsAnalytics({
      stock: [
        stockItem({ id: 1, stockUnits: 3, inventoryCostCents: 900 }),
        stockItem({ id: 2, stockUnits: 2, inventoryCostCents: null }),
      ],
      sales: { unitsSold: 1, revenueCents: 1000, soldCostCents: 500 },
      month: null,
    });

    expect(result.stock.inventoryCostCents).toBeNull();
    expect(result.stock.potentialMarginCents).toBeNull();
    expect(result.stock.potentialMarginPercent).toBeNull();
    expect(result.stock.groupsWithoutCost).toBe(1);
    expect(result.stock.unitsWithoutCost).toBe(2);
    expect(result.sales.recoveryPercent).toBeNull();
  });

  it('converts the monthly overview to cents and estimates break-even', () => {
    const result = calculateLogisticsAnalytics({
      stock: [],
      sales: { unitsSold: 6, revenueCents: 9000, soldCostCents: 5000 },
      month,
    });

    expect(result.month.salesCents).toBe(100000);
    expect(result.month.costCents).toBe(40000);
    expect(result.month.grossCents).toBe(60000);
    expect(result.month.expensesCents).toBe(10000);
    expect(result.month.netCents).toBe(50000);
    expect(result.month.salaryCents).toBe(30000);
    expect(result.month.averageDailyNetCents).toBe(2500);
    expect(result.month.dataphoneCents).toBe(40000);
    expect(result.month.grossMarginPercent).toBe(60);
    expect(result.month.netMarginPercent).toBe(50);
    expect(result.month.breakEvenSalesCents).toBe(16667);
    expect(result.month.breakEvenUnits).toBe(12);
    expect(result.month.trackedDays).toBe(20);
    expect(result.insights.dataphoneSharePercent).toBe(40);
    expect(result.insights.averageDailySalesCents).toBe(5000);
    expect(result.insights.averageDailyExpensesCents).toBe(500);
    expect(result.insights.projectedNetCents).toBe(75000);
  });

  it('derives per-day insights from the daily records', () => {
    const result = calculateLogisticsAnalytics({
      stock: [],
      sales: { unitsSold: 0, revenueCents: 0, soldCostCents: null },
      month,
      days: [
        { date: '2026-11-02', totalSold: 100, additionalExpenses: 20, grossProfit: 30, netProfit: 10, dataphoneSales: 50 },
        { date: '2026-11-03', totalSold: 200, additionalExpenses: 80, grossProfit: 60, netProfit: -20, dataphoneSales: 100 },
        { date: '2026-11-04', totalSold: 300, additionalExpenses: 10, grossProfit: 90, netProfit: 80, dataphoneSales: 250 },
      ],
    });

    expect(result.insights.bestDay).toEqual({ date: '2026-11-04', netCents: 8000 });
    expect(result.insights.lossDays).toBe(1);
  });
});
