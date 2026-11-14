import { getSupabaseClient } from '../../../core/backend/supabaseClient';
import { DailyRecordRepository } from '../application/DailyRecordRepository';
import { DailyRecord } from '../domain/types';

type DailyRecordRow = {
  date: string;
  total_sold: number | string;
  additional_expenses: number | string;
  profit_percent: number | string;
  notes: string;
  dataphone_sales: number | string;
};

type InvestmentCostRow = Pick<DailyRecordRow, 'total_sold' | 'profit_percent'>;

const DAILY_RECORD_COLUMNS = 'date,total_sold,additional_expenses,profit_percent,notes,dataphone_sales';

function mapDailyRecord(row: DailyRecordRow): DailyRecord {
  return {
    date: row.date,
    totalSold: Number(row.total_sold),
    additionalExpenses: Number(row.additional_expenses),
    profitPercent: Number(row.profit_percent),
    notes: row.notes,
    dataphoneSales: Number(row.dataphone_sales),
  };
}

function nextMonth(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number);
  return monthNumber === 12
    ? `${year + 1}-01-01`
    : `${year}-${String(monthNumber + 1).padStart(2, '0')}-01`;
}

export class SupabaseDailyRecordRepository implements DailyRecordRepository {
  async upsert(record: DailyRecord): Promise<void> {
    const { error } = await getSupabaseClient()
      .from('daily_records')
      .upsert({
        date: record.date,
        total_sold: record.totalSold,
        additional_expenses: record.additionalExpenses,
        profit_percent: record.profitPercent,
        notes: record.notes,
        dataphone_sales: record.dataphoneSales ?? 0,
      }, { onConflict: 'business_id,date' });
    if (error) throw error;
  }

  async findByDate(date: string): Promise<DailyRecord | null> {
    const { data, error } = await getSupabaseClient()
      .from('daily_records')
      .select(DAILY_RECORD_COLUMNS)
      .eq('date', date)
      .maybeSingle();
    if (error) throw error;
    return data ? mapDailyRecord(data as DailyRecordRow) : null;
  }

  async findMostRecentOnOrBefore(date: string): Promise<DailyRecord | null> {
    const { data, error } = await getSupabaseClient()
      .from('daily_records')
      .select(DAILY_RECORD_COLUMNS)
      .lte('date', date)
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data ? mapDailyRecord(data as DailyRecordRow) : null;
  }

  async findByMonth(month: string): Promise<DailyRecord[]> {
    const { data, error } = await getSupabaseClient()
      .from('daily_records')
      .select(DAILY_RECORD_COLUMNS)
      .gte('date', `${month}-01`)
      .lt('date', nextMonth(month))
      .order('date', { ascending: true });
    if (error) throw error;
    return (data ?? []).map((row) => mapDailyRecord(row as DailyRecordRow));
  }

  async sumInvestmentCost(): Promise<number> {
    const pageSize = 1000;
    let offset = 0;
    let total = 0;

    while (true) {
      const { data, error } = await getSupabaseClient()
        .from('daily_records')
        .select('total_sold,profit_percent')
        .order('date', { ascending: true })
        .range(offset, offset + pageSize - 1);
      if (error) throw error;

      const rows = (data ?? []) as InvestmentCostRow[];
      total = rows.reduce(
        (sum, row) => sum + Number(row.total_sold) * (1 - Number(row.profit_percent)),
        total,
      );
      if (rows.length < pageSize) return total;
      offset += pageSize;
    }
  }
}
