import {
  CompleteSaleInput,
  AddStoreStockInput,
  CreateCategoryInput,
  CreatePriceGroupInput,
  ReceiveStockInput,
  SaleReceipt,
  StockMovement,
  StoreCategory,
  StorePriceGroup,
  StoreStockItem,
  StoreDashboardSummary,
  TodaySalesSummary,
} from '../domain/types';

export interface StoreRepository {
  listCategories(): Promise<StoreCategory[]>;
  listStockItems(): Promise<StoreStockItem[]>;
  getDashboardSummary(categoryId?: number): Promise<StoreDashboardSummary>;
  createCategory(input: CreateCategoryInput): Promise<StoreCategory>;
  listPriceGroups(categoryId: number): Promise<StorePriceGroup[]>;
  createPriceGroup(input: CreatePriceGroupInput): Promise<StorePriceGroup>;
  receiveStock(input: ReceiveStockInput): Promise<StorePriceGroup>;
  addStock(input: AddStoreStockInput): Promise<StorePriceGroup>;
  completeSale(input: CompleteSaleInput): Promise<SaleReceipt>;
  getTodaySummary(date: string): Promise<TodaySalesSummary>;
  listRecentMovements(limit?: number): Promise<StockMovement[]>;
}
