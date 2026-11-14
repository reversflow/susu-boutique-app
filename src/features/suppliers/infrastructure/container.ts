import { SupplierService } from '../application/SupplierService';
import { SupabaseSupplierRepository } from './SupabaseSupplierRepository';

const supplierRepository = new SupabaseSupplierRepository();

export const supplierService = new SupplierService(supplierRepository);
