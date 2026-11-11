import { CompleteSaleInput, SaleLineInput } from './types';

export function positiveInteger(value: number, message: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) throw new RangeError(message);
  return value;
}

export function safeTotal(values: number[]): number {
  const total = values.reduce((sum, value) => sum + value, 0);
  return positiveInteger(total, 'El importe o las unidades superan el límite permitido.');
}

export function normalizeSale(input: CompleteSaleInput): { items: SaleLineInput[]; requestId: string | null } {
  const cart = 'items' in input;
  const items = cart ? input.items : [input];
  if (!Array.isArray(items) || items.length === 0 || items.length > 100) {
    throw new RangeError('Agregá entre 1 y 100 líneas a la venta.');
  }
  if (cart && (typeof input.requestId !== 'string' || !/^[\w-]{8,100}$/.test(input.requestId))) {
    throw new RangeError('La referencia de venta no es válida.');
  }
  return {
    requestId: cart ? input.requestId : null,
    items: items.map((item) => {
      positiveInteger(item.priceGroupId, 'Elegí un grupo de precio.');
      positiveInteger(item.units, 'Vendé al menos una unidad.');
      if (item.unitPriceCents !== undefined) {
        positiveInteger(item.unitPriceCents, 'El precio pactado debe ser mayor que cero y expresarse en céntimos enteros.');
        safeTotal([item.unitPriceCents * item.units]);
      }
      return { priceGroupId: item.priceGroupId, units: item.units, ...(item.unitPriceCents === undefined ? {} : { unitPriceCents: item.unitPriceCents }) };
    }),
  };
}

/** Strict decimal parsing, without floating point currency conversion. */
export function parseSalePrice(value: string): number | null {
  const text = value.trim();
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(text)) return null;
  const [whole, decimal = ''] = text.replace(',', '.').split('.');
  const cents = Number(whole) * 100 + Number(decimal.padEnd(2, '0'));
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}
