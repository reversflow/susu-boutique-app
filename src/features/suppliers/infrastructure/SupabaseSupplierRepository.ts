import { getSupabaseClient } from '../../../core/backend/supabaseClient';
import { NewSupplier, Supplier } from '../domain/types';
import { SupplierRepository } from '../application/SupplierRepository';

type SupplierRow = {
  id: number | string;
  name: string;
  phone: string;
  notes: string;
  created_at: string;
};

function mapSupplier(row: SupplierRow): Supplier {
  return {
    id: Number(row.id),
    name: row.name,
    phone: row.phone,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

const SUPPLIER_COLUMNS = 'id,name,phone,notes,created_at';

export class SupabaseSupplierRepository implements SupplierRepository {
  async list(): Promise<Supplier[]> {
    const { data, error } = await getSupabaseClient()
      .from('suppliers')
      .select(SUPPLIER_COLUMNS)
      .order('name', { ascending: true });
    if (error) throw error;
    return (data ?? []).map((row) => mapSupplier(row as SupplierRow));
  }

  async findById(id: number): Promise<Supplier | null> {
    const { data, error } = await getSupabaseClient()
      .from('suppliers')
      .select(SUPPLIER_COLUMNS)
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data ? mapSupplier(data as SupplierRow) : null;
  }

  async create(input: NewSupplier): Promise<Supplier> {
    const { data, error } = await getSupabaseClient()
      .from('suppliers')
      .insert(input)
      .select(SUPPLIER_COLUMNS)
      .single();
    if (error) throw error;
    return mapSupplier(data as SupplierRow);
  }

  async update(id: number, input: NewSupplier): Promise<Supplier | null> {
    const { data, error } = await getSupabaseClient()
      .from('suppliers')
      .update(input)
      .eq('id', id)
      .select(SUPPLIER_COLUMNS)
      .maybeSingle();
    if (error) throw error;
    return data ? mapSupplier(data as SupplierRow) : null;
  }

  async remove(id: number): Promise<void> {
    const { error } = await getSupabaseClient()
      .from('suppliers')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }
}
