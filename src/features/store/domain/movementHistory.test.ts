import { describe, expect, it } from 'vitest';
import { groupMovementsByDay, summarizeMovements } from './movementHistory';
import { StockMovement } from './types';

function movement(overrides: Partial<StockMovement> & Pick<StockMovement, 'id'>): StockMovement {
  return {
    categoryName: 'Anillos',
    priceCents: 500,
    movementType: 'venta',
    unitsDelta: -2,
    supplierName: null,
    note: '',
    createdAt: '2026-11-10T14:32:05',
    costTotalCents: null,
    chargedTotalCents: null,
    ...overrides,
  };
}

describe('summarizeMovements', () => {
  it('keeps total profit pending when any sale is incomplete', () => {
    const totals = summarizeMovements([
      movement({ id: 1, chargedTotalCents: 1200, costTotalCents: 700 }),
      movement({ id: 2, movementType: 'entrada', unitsDelta: 5, costTotalCents: 400 }),
      movement({ id: 3, chargedTotalCents: 500, costTotalCents: null }),
    ]);

    expect(totals).toEqual({
      salesCents: 1700,
      salesCount: 2,
      purchaseCents: 400,
      purchaseCount: 1,
      purchasePendingCount: 0,
      unitsSold: 4,
      profitCents: null,
      pendingCount: 1,
    });
  });

  it('leaves profit pending when every sale is incomplete and zero when there are none', () => {
    expect(summarizeMovements([movement({ id: 1 })]).profitCents).toBeNull();
    expect(summarizeMovements([movement({ id: 2, movementType: 'entrada', unitsDelta: 1, costTotalCents: 100 })]).profitCents).toBe(0);
  });

  it('keeps purchase cost pending when any entry has no registered cost', () => {
    const totals = summarizeMovements([
      movement({ id: 1, movementType: 'entrada', unitsDelta: 2, costTotalCents: 400 }),
      movement({ id: 2, movementType: 'entrada', unitsDelta: 1, costTotalCents: null }),
    ]);

    expect(totals.purchaseCents).toBeNull();
    expect(totals.purchaseCount).toBe(2);
    expect(totals.purchasePendingCount).toBe(1);
  });

  it('treats an explicit zero purchase cost as known', () => {
    const totals = summarizeMovements([
      movement({ id: 1, movementType: 'entrada', unitsDelta: 1, costTotalCents: 0 }),
    ]);

    expect(totals.purchaseCents).toBe(0);
    expect(totals.purchasePendingCount).toBe(0);
  });
});

describe('groupMovementsByDay', () => {
  it('keeps the newest-first order while grouping by local day', () => {
    const groups = groupMovementsByDay([
      movement({ id: 1, createdAt: '2026-11-10T18:00:00' }),
      movement({ id: 2, createdAt: '2026-11-10T09:00:00' }),
      movement({ id: 3, createdAt: '2026-11-09T20:00:00' }),
    ]);

    expect(groups.map((group) => group.day)).toEqual(['2026-11-10', '2026-11-09']);
    expect(groups[0].movements.map((item) => item.id)).toEqual([1, 2]);
    expect(groups[1].movements.map((item) => item.id)).toEqual([3]);
  });
});
