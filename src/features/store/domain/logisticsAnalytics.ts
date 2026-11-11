import { LOW_STOCK_THRESHOLD } from './lowStockAlert';
import { nonnegativeTotal } from './stockCost';
import type { StoreDashboardSummary, StoreStockItem } from './types';

/** The monthly overview from daily records works in euros; the store works in cents. */
export interface LogisticsMonthInput {
  totalSold: number;
  totalInvested: number;
  totalAdditionalExpenses: number;
  grossProfit: number;
  netProfit: number;
  averageDailyNetProfit: number;
  estimatedSalary: number;
  trackedDays: number;
  totalDataphoneSales: number;
  daysInMonth: number;
}

/** One day from the monthly overview; money arrives in euros like the rest of daily records. */
export interface LogisticsDayInput {
  date: string;
  totalSold: number;
  additionalExpenses: number;
  grossProfit: number;
  netProfit: number;
  dataphoneSales: number;
}

export interface LogisticsInsights {
  bestDay: { date: string; netCents: number } | null;
  lossDays: number;
  dataphoneSharePercent: number | null;
  averageDailySalesCents: number | null;
  averageDailyExpensesCents: number | null;
  /** Net profit projected to the whole month at the current daily pace. */
  projectedNetCents: number | null;
}

export interface CategoryCapital {
  categoryId: number;
  name: string;
  units: number;
  retailCents: number;
  /** Purchase value of the remaining units; null when any unit has an unknown cost. */
  costCents: number | null;
}

export interface LogisticsAnalytics {
  stock: {
    unitsAvailable: number;
    unitsSold: number;
    unitsTotal: number;
    sellThroughPercent: number | null;
    retailValueCents: number;
    inventoryCostCents: number | null;
    potentialMarginCents: number | null;
    potentialMarginPercent: number | null;
    averageSalePriceCents: number | null;
    lowStockGroups: number;
    outOfStockGroups: number;
    groupsWithoutCost: number;
    unitsWithoutCost: number;
    topCategories: CategoryCapital[];
  };
  sales: {
    revenueCents: number;
    soldCostCents: number | null;
    grossCents: number | null;
    grossMarginPercent: number | null;
    averageTicketCents: number | null;
    recoveryPercent: number | null;
  };
  month: {
    salesCents: number;
    costCents: number;
    grossCents: number;
    expensesCents: number;
    netCents: number;
    salaryCents: number;
    averageDailyNetCents: number;
    dataphoneCents: number;
    grossMarginPercent: number | null;
    netMarginPercent: number | null;
    /** Sales needed to cover this month's expenses at the current gross margin. */
    breakEvenSalesCents: number | null;
    /** Break-even translated to units using the average ticket. */
    breakEvenUnits: number | null;
    trackedDays: number;
  };
  insights: LogisticsInsights;
}

export interface LogisticsAnalyticsInput {
  stock: StoreStockItem[];
  sales: StoreDashboardSummary;
  month: LogisticsMonthInput | null;
  days?: LogisticsDayInput[];
}

function eurosToCents(value: number): number {
  return Math.round(value * 100);
}

function ratioPercent(part: number | null, total: number | null): number | null {
  if (part == null || total == null || total <= 0) return null;
  return Math.round((100 * part) / total);
}

function average(total: number, count: number): number | null {
  if (!Number.isFinite(total) || count <= 0) return null;
  return Math.round(total / count);
}

function groupByCategory(stock: StoreStockItem[]): CategoryCapital[] {
  const byCategory = new Map<number, CategoryCapital>();

  for (const item of stock) {
    const current = byCategory.get(item.categoryId) ?? {
      categoryId: item.categoryId,
      name: item.categoryName,
      units: 0,
      retailCents: 0,
      costCents: 0,
    };

    current.units += item.stockUnits;
    current.retailCents += item.stockUnits * item.priceCents;
    current.costCents =
      current.costCents == null || item.inventoryCostCents == null
        ? null
        : current.costCents + item.inventoryCostCents;

    byCategory.set(item.categoryId, current);
  }

  return [...byCategory.values()].sort((a, b) => b.retailCents - a.retailCents);
}

function emptyMonth(): LogisticsAnalytics['month'] {
  return {
    salesCents: 0,
    costCents: 0,
    grossCents: 0,
    expensesCents: 0,
    netCents: 0,
    salaryCents: 0,
    averageDailyNetCents: 0,
    dataphoneCents: 0,
    grossMarginPercent: null,
    netMarginPercent: null,
    breakEvenSalesCents: null,
    breakEvenUnits: null,
    trackedDays: 0,
  };
}

/**
 * Builds every number shown on the logistics dashboard.
 *
 * Money from the store is already in cents; the monthly overview arrives in
 * euros and is normalized to cents here so the UI only formats one unit.
 */
export function calculateLogisticsAnalytics({
  stock,
  sales,
  month,
  days = [],
}: LogisticsAnalyticsInput): LogisticsAnalytics {
  const unitsAvailable = nonnegativeTotal(stock.map((item) => item.stockUnits));
  const unitsSold = Math.max(0, sales.unitsSold);
  const unitsTotal = unitsAvailable + unitsSold;

  const retailValueCents = nonnegativeTotal(
    stock.map((item) => nonnegativeTotal([item.stockUnits * item.priceCents])),
  );

  const inventoryCostCents = stock.some((item) => item.inventoryCostCents == null)
    ? null
    : nonnegativeTotal(stock.map((item) => item.inventoryCostCents ?? 0));

  const potentialMarginCents =
    inventoryCostCents == null ? null : retailValueCents - inventoryCostCents;

  const soldCostCents = sales.soldCostCents;
  const grossCents = soldCostCents == null ? null : sales.revenueCents - soldCostCents;

  const monthSalesCents = month ? eurosToCents(month.totalSold) : 0;
  const monthCostCents = month ? eurosToCents(month.totalInvested) : 0;
  const monthGrossCents = month ? eurosToCents(month.grossProfit) : 0;
  const monthExpensesCents = month ? eurosToCents(month.totalAdditionalExpenses) : 0;
  const monthNetCents = month ? eurosToCents(month.netProfit) : 0;

  const monthGrossMarginPercent = month
    ? ratioPercent(monthGrossCents, monthSalesCents)
    : null;
  const monthNetMarginPercent = month ? ratioPercent(monthNetCents, monthSalesCents) : null;

  // Break-even: how much must be sold this month to absorb its expenses.
  const monthBreakEvenSalesCents =
    month && monthExpensesCents > 0 && monthGrossMarginPercent != null && monthGrossMarginPercent > 0
      ? Math.round((monthExpensesCents * 100) / monthGrossMarginPercent)
      : null;

  const averageTicketCents = average(sales.revenueCents, unitsSold);

  const monthBreakEvenUnits =
    monthBreakEvenSalesCents != null && averageTicketCents != null && averageTicketCents > 0
      ? Math.ceil(monthBreakEvenSalesCents / averageTicketCents)
      : null;

  const investmentCents =
    inventoryCostCents == null || soldCostCents == null
      ? null
      : inventoryCostCents + soldCostCents;

  const categories = groupByCategory(stock);

  const bestDay = days.reduce<{ date: string; netCents: number } | null>(
    (best, day) => {
      const netCents = eurosToCents(day.netProfit);
      return best == null || netCents > best.netCents ? { date: day.date, netCents } : best;
    },
    null,
  );

  const insights: LogisticsInsights = {
    bestDay,
    lossDays: days.filter((day) => eurosToCents(day.netProfit) < 0).length,
    dataphoneSharePercent: month
      ? ratioPercent(eurosToCents(month.totalDataphoneSales), monthSalesCents)
      : null,
    averageDailySalesCents: month ? average(monthSalesCents, month.trackedDays) : null,
    averageDailyExpensesCents: month ? average(monthExpensesCents, month.trackedDays) : null,
    projectedNetCents:
      month && month.trackedDays > 0 && month.daysInMonth > 0
        ? Math.round((monthNetCents / month.trackedDays) * month.daysInMonth)
        : null,
  };

  return {
    stock: {
      unitsAvailable,
      unitsSold,
      unitsTotal,
      sellThroughPercent: ratioPercent(unitsSold, unitsTotal),
      retailValueCents,
      inventoryCostCents,
      potentialMarginCents,
      potentialMarginPercent: ratioPercent(potentialMarginCents, retailValueCents),
      averageSalePriceCents: average(retailValueCents, unitsAvailable),
      lowStockGroups: stock.filter((item) => item.stockUnits <= LOW_STOCK_THRESHOLD).length,
      outOfStockGroups: stock.filter((item) => item.stockUnits === 0).length,
      groupsWithoutCost: stock.filter((item) => item.inventoryCostCents == null).length,
      unitsWithoutCost: nonnegativeTotal(
        stock
          .filter((item) => item.inventoryCostCents == null)
          .map((item) => item.stockUnits),
      ),
      topCategories: categories.slice(0, 3),
    },
    sales: {
      revenueCents: sales.revenueCents,
      soldCostCents,
      grossCents,
      grossMarginPercent: ratioPercent(grossCents, sales.revenueCents),
      averageTicketCents,
      recoveryPercent: ratioPercent(sales.revenueCents, investmentCents),
    },
    month: month
      ? {
          salesCents: monthSalesCents,
          costCents: monthCostCents,
          grossCents: monthGrossCents,
          expensesCents: monthExpensesCents,
          netCents: monthNetCents,
          salaryCents: eurosToCents(month.estimatedSalary),
          averageDailyNetCents: eurosToCents(month.averageDailyNetProfit),
          dataphoneCents: eurosToCents(month.totalDataphoneSales),
          grossMarginPercent: monthGrossMarginPercent,
          netMarginPercent: monthNetMarginPercent,
          breakEvenSalesCents: monthBreakEvenSalesCents,
          breakEvenUnits: monthBreakEvenUnits,
          trackedDays: month.trackedDays,
        }
      : emptyMonth(),
    insights,
  };
}
