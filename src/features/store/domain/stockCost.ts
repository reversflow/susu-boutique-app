export function nonnegativeTotal(values: number[]): number {
  let total = 0;
  for (const value of values) {
    if (!Number.isSafeInteger(value) || value < 0) throw new RangeError('El coste supera el límite permitido.');
    total += value;
    if (!Number.isSafeInteger(total)) throw new RangeError('El coste supera el límite permitido.');
  }
  return total;
}

export function validatePurchaseCost(cost: number | null | undefined, units: number): number | null {
  if (cost == null) return null;
  nonnegativeTotal([cost]);
  return nonnegativeTotal([cost * units]);
}

export function completeCost(values: Array<number | null | undefined>): number | null {
  return values.some((value) => value == null) ? null : nonnegativeTotal(values as number[]);
}

export function parsePurchaseCost(value: string): number | null {
  const text = value.trim();
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(text)) return null;
  const [whole, fraction = ''] = text.replace(',', '.').split('.');
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(result) && result >= 0 ? result : null;
}

export interface CostLot { id: number; remaining_units: number; unit_cost_cents: number | null }

/** Mutates the working lot balances so subsequent cart lines consume the next available units. */
export function consumeFifo(lots: CostLot[], units: number): number | null {
  let needed = units;
  const costs: Array<number | null> = [];
  for (const lot of lots) {
    const taken = Math.min(lot.remaining_units, needed);
    if (taken <= 0) continue;
    costs.push(lot.unit_cost_cents === null ? null : nonnegativeTotal([lot.unit_cost_cents * taken]));
    lot.remaining_units -= taken;
    needed -= taken;
    if (needed === 0) break;
  }
  if (needed !== 0) throw new Error('El detalle de lotes no coincide con el stock. No se registró la venta.');
  return completeCost(costs);
}
