export interface StoreCategory {
  id: number;
  name: string;
  sortOrder: number;
}

export interface StorePriceGroup {
  id: number;
  categoryId: number;
  priceCents: number;
  stockUnits: number;
  sortOrder: number;
  photoDataUrl: string;
  /** Purchase value of remaining units; null when any unit has unknown cost. */
  inventoryCostCents?: number | null;
}

export interface StoreStockItem extends StorePriceGroup {
  categoryName: string;
}

export type StockMovementType = 'venta' | 'entrada' | 'ajuste';

export interface StockMovement {
  id: number;
  categoryName: string;
  priceCents: number;
  movementType: StockMovementType;
  unitsDelta: number;
  supplierName: string | null;
  note: string;
  createdAt: string;
  costTotalCents?: number | null;
  chargedTotalCents?: number | null;
}

export interface TodaySalesSummary {
  totalCents: number;
  unitsSold: number;
  costTotalCents?: number | null;
  profitCents?: number | null;
}

/** All recorded sales and current inventory, across the lifetime of the local database. */
export interface StoreDashboardSummary {
  unitsSold: number;
  revenueCents: number;
  soldCostCents: number | null;
}

export interface SaleReceipt {
  saleId: number;
  unitsSold: number;
  unitPriceCents: number;
  totalCents: number;
  remainingUnits: number;
  items?: SaleReceiptItem[];
  costTotalCents?: number | null;
  profitCents?: number | null;
}

export interface SaleReceiptItem {
  priceGroupId: number;
  units: number;
  baseUnitPriceCents: number;
  unitPriceCents: number;
  totalCents: number;
  remainingUnits: number;
  costTotalCents?: number | null;
}

export interface CreateCategoryInput {
  name: string;
}

export interface CreatePriceGroupInput {
  categoryId: number;
  priceCents: number;
  photoDataUrl?: string;
}

export interface ReceiveStockInput {
  priceGroupId: number;
  units: number;
  supplierId: number | null;
  note: string;
  unitCostCents?: number | null;
}

export interface AddStoreStockInput {
  categoryId: number;
  priceCents: number;
  units: number;
  photoDataUrl: string | null;
  unitCostCents?: number | null;
}

export interface SaleLineInput {
  priceGroupId: number;
  units: number;
  /** Omit to charge the catalog price. A supplied price is agreed per unit. */
  unitPriceCents?: number;
}

export type CompleteSaleInput = SaleLineInput | {
  items: SaleLineInput[];
  requestId: string;
};
