import { getSupabaseClient } from '../../../../core/backend/supabaseClient';
import {
  AddInvestmentAdjustmentInput,
  InvestmentAdjustmentRepository,
} from '../application/InvestmentAdjustmentRepository';
import {
  InvestmentAdjustment,
  InvestmentHistoryCursor,
  InvestmentHistoryItem,
  InvestmentHistoryPage,
  InvestmentHistoryPageRequest,
  InvestmentType,
} from '../domain/types';

type InvestmentAdjustmentRow = {
  id: number | string;
  date: string;
  amount: number | string;
  note: string;
  type: string;
  supplier_id: number | string | null;
};

type SupplierRelation = { name: string } | Array<{ name: string }> | null;
type InvestmentHistoryRow = InvestmentAdjustmentRow & { supplier: SupplierRelation };

function mapAdjustment(row: InvestmentAdjustmentRow): InvestmentAdjustment {
  return {
    id: Number(row.id),
    date: row.date,
    amount: Number(row.amount),
    note: row.note,
    type: row.type === 'compra' ? 'compra' : 'ajuste',
    supplierId: row.supplier_id == null ? null : Number(row.supplier_id),
  };
}

function historyPageSize(limit: number): number {
  const requestedLimit = Number.isFinite(limit) ? Math.floor(limit) : 25;
  return Math.min(100, Math.max(1, requestedLimit));
}

function monthRange(month: string): { start: string; end: string } {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) throw new RangeError('Invalid investment history month');

  const year = Number(match[1]);
  const monthNumber = Number(match[2]);
  if (monthNumber < 1 || monthNumber > 12) {
    throw new RangeError('Invalid investment history month');
  }
  const end = monthNumber === 12
    ? `${year + 1}-01-01`
    : `${year}-${String(monthNumber + 1).padStart(2, '0')}-01`;
  return { start: `${month}-01`, end };
}

function mapHistoryItem(row: InvestmentHistoryRow): InvestmentHistoryItem {
  const supplier = Array.isArray(row.supplier) ? row.supplier[0] : row.supplier;
  return {
    id: Number(row.id),
    date: row.date,
    amount: Number(row.amount),
    note: row.note,
    type: row.type === 'compra' ? 'compra' : 'ajuste',
    supplierName: supplier?.name ?? null,
  };
}

const ADJUSTMENT_COLUMNS = 'id,date,amount,note,type,supplier_id';

async function sumByType(type: InvestmentType): Promise<number> {
  const pageSize = 1000;
  let offset = 0;
  let total = 0;

  while (true) {
    const { data, error } = await getSupabaseClient()
      .from('investment_adjustments')
      .select('id,amount')
      .eq('type', type)
      .order('id', { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw error;

    const rows = data ?? [];
    total = rows.reduce((sum, row) => sum + Number(row.amount), total);
    if (rows.length < pageSize) return total;
    offset += pageSize;
  }
}

export class SupabaseInvestmentAdjustmentRepository implements InvestmentAdjustmentRepository {
  async add(input: AddInvestmentAdjustmentInput): Promise<InvestmentAdjustment> {
    const { data, error } = await getSupabaseClient()
      .from('investment_adjustments')
      .insert({
        date: input.date,
        amount: input.amount,
        note: input.note,
        type: input.type ?? 'ajuste',
        supplier_id: input.supplierId ?? null,
      })
      .select(ADJUSTMENT_COLUMNS)
      .single();
    if (error) throw error;
    return mapAdjustment(data as InvestmentAdjustmentRow);
  }

  async listAll(types?: InvestmentType[]): Promise<InvestmentAdjustment[]> {
    const pageSize = 1000;
    const rows: InvestmentAdjustmentRow[] = [];
    let offset = 0;

    while (true) {
      let query = getSupabaseClient()
        .from('investment_adjustments')
        .select(ADJUSTMENT_COLUMNS);
      if (types && types.length > 0) query = query.in('type', types);

      const { data, error } = await query
        .order('date', { ascending: true })
        .order('id', { ascending: true })
        .range(offset, offset + pageSize - 1);
      if (error) throw error;

      const page = (data ?? []) as InvestmentAdjustmentRow[];
      rows.push(...page);
      if (page.length < pageSize) return rows.map(mapAdjustment);
      offset += pageSize;
    }
  }

  async listHistoryPage(request: InvestmentHistoryPageRequest): Promise<InvestmentHistoryPage> {
    const pageSize = historyPageSize(request.limit);
    let query = getSupabaseClient()
      .from('investment_adjustments')
      .select('id,date,amount,note,type,supplier_id,supplier:suppliers(name)');

    if (request.type) query = query.eq('type', request.type);
    if (request.month) {
      const range = monthRange(request.month);
      query = query.gte('date', range.start).lt('date', range.end);
    }
    if (request.cursor) {
      const cursor = request.cursor;
      query = query.or(`date.lt.${cursor.date},and(date.eq.${cursor.date},id.lt.${cursor.id})`);
    }

    const { data, error } = await query
      .order('date', { ascending: false })
      .order('id', { ascending: false })
      .limit(pageSize + 1);
    if (error) throw error;

    const rows = (data ?? []) as InvestmentHistoryRow[];
    const hasMore = rows.length > pageSize;
    const pageRows = hasMore ? rows.slice(0, pageSize) : rows;
    const items = pageRows.map(mapHistoryItem);
    const last = items[items.length - 1];
    const nextCursor: InvestmentHistoryCursor | null = hasMore && last
      ? { date: last.date, id: last.id }
      : null;
    return { items, hasMore, nextCursor };
  }

  async sumAmount(): Promise<number> {
    return sumByType('ajuste');
  }

  async sumPurchases(): Promise<number> {
    return sumByType('compra');
  }
}
