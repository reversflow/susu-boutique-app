import { StoreDashboardSummary, StoreStockItem } from './types';
import { nonnegativeTotal } from './stockCost';

export function calculateStoreDashboard(stock: StoreStockItem[], sales: StoreDashboardSummary) {
  const remaining = nonnegativeTotal(stock.map((item) => item.stockUnits));
  const total = nonnegativeTotal([remaining, sales.unitsSold]);
  const inventoryCost = stock.some((item) => item.inventoryCostCents == null)
    ? null : nonnegativeTotal(stock.map((item) => item.inventoryCostCents ?? 0));
  const investment = inventoryCost == null || sales.soldCostCents == null
    ? null : nonnegativeTotal([inventoryCost, sales.soldCostCents]);
  const remainingRevenue = nonnegativeTotal(stock.map((item) => nonnegativeTotal([item.stockUnits * item.priceCents])));
  const projectedRevenue = nonnegativeTotal([sales.revenueCents, remainingRevenue]);
  const recoveryPercent = investment == null || total === 0
    ? null
    : investment === 0
      ? 100
      : Math.min(100, Math.round(100 * sales.revenueCents / investment));
  return {
    remaining, total,
    percentRemaining: total ? Math.round(100 * remaining / total) : null,
    inventoryCost,
    investment,
    projectedRevenue,
    recoveryPercent,
    missingInvestment: investment == null ? null : Math.max(0, investment - sales.revenueCents),
    realizedGross: sales.soldCostCents == null ? null : sales.revenueCents - sales.soldCostCents,
    projectedGross: investment == null ? null : projectedRevenue - investment,
  };
}
