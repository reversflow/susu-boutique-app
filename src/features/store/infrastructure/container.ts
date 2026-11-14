import { StoreService } from '../application/StoreService';
import { SupabaseStoreRepository } from './SupabaseStoreRepository';

export const storeService = new StoreService(new SupabaseStoreRepository());
