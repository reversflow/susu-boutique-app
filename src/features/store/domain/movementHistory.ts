import type { StockMovement } from './types';

/** Totals for a list of movements, as shown in the logistics panel and history screen. */
export interface MovementTotals {
  salesCents: number;
  salesCount: number;
  /** Total purchase cost; null when any purchase has no registered cost. */
  purchaseCents: number | null;
  purchaseCount: number;
  purchasePendingCount: number;
  unitsSold: number;
  /** Charged minus cost over all sales; null when any sale is incomplete. */
  profitCents: number | null;
  /** Sales still missing cost or charged amount. */
  pendingCount: number;
}

export function summarizeMovements(movements: StockMovement[]): MovementTotals {
  const totals: MovementTotals = {
    salesCents: 0,
    salesCount: 0,
    purchaseCents: 0,
    purchaseCount: 0,
    purchasePendingCount: 0,
    unitsSold: 0,
    profitCents: 0,
    pendingCount: 0,
  };
  let profit = 0;

  for (const movement of movements) {
    if (movement.movementType === 'venta') {
      totals.salesCount += 1;
      totals.unitsSold += Math.max(0, -movement.unitsDelta);
      const charged = movement.chargedTotalCents ?? null;
      const cost = movement.costTotalCents ?? null;
      if (charged != null) totals.salesCents += charged;
      if (charged != null && cost != null) {
        profit += charged - cost;
      } else {
        totals.pendingCount += 1;
      }
    } else if (movement.movementType === 'entrada') {
      totals.purchaseCount += 1;
      if (movement.costTotalCents == null) {
        totals.purchasePendingCount += 1;
      } else if (totals.purchaseCents != null) {
        totals.purchaseCents += movement.costTotalCents;
      }
    }
  }

  totals.profitCents = totals.pendingCount > 0 ? null : profit;
  if (totals.purchasePendingCount > 0) totals.purchaseCents = null;
  return totals;
}

export interface MovementDayGroup {
  /** Local calendar day, YYYY-MM-DD. */
  day: string;
  movements: StockMovement[];
}

/** Groups movements (already sorted newest first) into consecutive days without changing the order. */
export function groupMovementsByDay(movements: StockMovement[]): MovementDayGroup[] {
  const groups: MovementDayGroup[] = [];
  const byDay = new Map<string, StockMovement[]>();
  for (const movement of movements) {
    const day = movement.createdAt.slice(0, 10);
    const list = byDay.get(day);
    if (list) {
      list.push(movement);
    } else {
      byDay.set(day, [movement]);
    }
  }
  for (const [day, list] of byDay) {
    groups.push({ day, movements: list });
  }
  return groups;
}
