import { getSupabaseClient } from '../../../core/backend/supabaseClient';
import { CompleteSaleInput, SaleReceipt, SaleReceiptItem, StoreCategory, StorePriceGroup, StoreStockItem, StockMovement, TodaySalesSummary, StoreDashboardSummary, CreateCategoryInput, CreatePriceGroupInput, AddStoreStockInput, ReceiveStockInput } from '../domain/types';
import { StoreRepository } from '../application/StoreRepository';
import { normalizeSale } from '../domain/salePricing';
import { nonnegativeTotal } from '../domain/stockCost';

const PRODUCT_IMAGE_BUCKET = 'store-product-images';
const SIGNED_URL_SECONDS = 60 * 60;

type CategoryRow = {
  id: number | string;
  name: string;
  sort_order: number;
};

type PriceGroupRow = {
  id: number | string;
  category_id: number | string;
  price_cents: number | string;
  stock_units: number;
  sort_order: number;
  photo_path: string;
};

type RpcPriceGroup = {
  id: number | string;
  categoryId: number | string;
  priceCents: number | string;
  stockUnits: number;
  sortOrder: number;
  photoPath: string;
};

type StockGroupRow = PriceGroupRow & {
  category: { name: string } | Array<{ name: string }>;
  lots: Array<{ remaining_units: number; unit_cost_cents: number | string | null }>;
};

type MovementRow = {
  id: number | string;
  movement_type: StockMovement['movementType'];
  units_delta: number;
  supplier_name: string | null;
  note: string;
  created_at: string;
  cost_total_cents: number | string | null;
  charged_total_cents: number | string | null;
  price_group: {
    price_cents: number | string;
    category: { name: string } | Array<{ name: string }>;
  } | Array<{
    price_cents: number | string;
    category: { name: string } | Array<{ name: string }>;
  }>;
  supplier: { name: string } | Array<{ name: string }> | null;
};

type RpcSaleReceipt = {
  saleId: number | string;
  unitsSold: number | string;
  unitPriceCents: number | string;
  totalCents: number | string;
  remainingUnits: number;
  costTotalCents?: number | string | null;
  profitCents?: number | string | null;
  items: Array<{
    priceGroupId: number | string;
    units: number;
    baseUnitPriceCents: number | string;
    unitPriceCents: number | string;
    totalCents: number | string;
    remainingUnits: number;
    costTotalCents?: number | string | null;
  }>;
};

function numberValue(value: number | string | null): number | null {
  return value === null ? null : Number(value);
}

function mapCategory(row: CategoryRow): StoreCategory {
  return { id: Number(row.id), name: row.name, sortOrder: row.sort_order };
}

function mapPriceGroup(row: PriceGroupRow, photoDataUrl: string): StorePriceGroup {
  return {
    id: Number(row.id),
    categoryId: Number(row.category_id),
    priceCents: Number(row.price_cents),
    stockUnits: row.stock_units,
    sortOrder: row.sort_order,
    photoDataUrl,
  };
}

function mapSaleReceipt(row: RpcSaleReceipt): SaleReceipt {
  const items: SaleReceiptItem[] = row.items.map((item) => ({
    priceGroupId: Number(item.priceGroupId),
    units: item.units,
    baseUnitPriceCents: Number(item.baseUnitPriceCents),
    unitPriceCents: Number(item.unitPriceCents),
    totalCents: Number(item.totalCents),
    remainingUnits: item.remainingUnits,
    ...(item.costTotalCents !== undefined ? { costTotalCents: numberValue(item.costTotalCents) } : {}),
  }));

  return {
    saleId: Number(row.saleId),
    unitsSold: Number(row.unitsSold),
    unitPriceCents: Number(row.unitPriceCents),
    totalCents: Number(row.totalCents),
    remainingUnits: row.remainingUnits,
    ...(row.costTotalCents !== undefined ? { costTotalCents: numberValue(row.costTotalCents) } : {}),
    ...(row.profitCents !== undefined ? { profitCents: numberValue(row.profitCents) } : {}),
    items,
  };
}

function decodeBase64(value: string): Uint8Array {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const bytes = new Uint8Array(Math.ceil(value.length * 3 / 4));
  let buffer = 0;
  let bits = 0;
  let index = 0;

  for (const character of value) {
    if (character === '=') break;
    const digit = alphabet.indexOf(character);
    if (digit < 0) continue;
    buffer = (buffer << 6) | digit;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes[index++] = (buffer >> bits) & 0xff;
      buffer &= (1 << bits) - 1;
    }
  }

  return bytes.slice(0, index);
}

function parseImageDataUrl(dataUrl: string): { contentType: string; extension: string; bytes: Uint8Array } {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) throw new Error('El formato de la imagen no es válido.');
  const contentType = match[1];
  const extension = contentType === 'image/jpeg' ? 'jpg' : contentType.slice('image/'.length);
  return { contentType, extension, bytes: decodeBase64(match[2]) };
}

async function getCurrentBusinessId(): Promise<string> {
  const client = getSupabaseClient();
  const { data: userResult, error: userError } = await client.auth.getUser();
  if (userError) throw userError;
  if (!userResult.user) throw new Error('Inicia sesión para continuar.');

  const { data, error } = await client
    .from('business_members')
    .select('business_id')
    .eq('user_id', userResult.user.id)
    .single();
  if (error) throw error;
  return data.business_id;
}

async function uploadProductImage(dataUrl: string, businessId: string): Promise<string> {
  const image = parseImageDataUrl(dataUrl);
  const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${image.extension}`;
  const path = `${businessId}/${uniqueName}`;
  const { error } = await getSupabaseClient().storage
    .from(PRODUCT_IMAGE_BUCKET)
    .upload(path, image.bytes.buffer as ArrayBuffer, {
      contentType: image.contentType,
      upsert: false,
    });
  if (error) throw error;
  return path;
}

async function removeProductImage(path: string): Promise<void> {
  await getSupabaseClient().storage.from(PRODUCT_IMAGE_BUCKET).remove([path]);
}

async function signedPhotoUrl(path: string): Promise<string> {
  if (!path) return '';
  const { data, error } = await getSupabaseClient().storage
    .from(PRODUCT_IMAGE_BUCKET)
    .createSignedUrl(path, SIGNED_URL_SECONDS);
  if (error) throw error;
  return data.signedUrl;
}

async function mapPriceGroupWithPhoto(row: PriceGroupRow): Promise<StorePriceGroup> {
  return mapPriceGroup(row, await signedPhotoUrl(row.photo_path));
}

async function mapRpcPriceGroup(row: RpcPriceGroup): Promise<StorePriceGroup> {
  return {
    id: Number(row.id),
    categoryId: Number(row.categoryId),
    priceCents: Number(row.priceCents),
    stockUnits: row.stockUnits,
    sortOrder: row.sortOrder,
    photoDataUrl: await signedPhotoUrl(row.photoPath),
  };
}

function dateRange(date: string): { start: string; end: string } {
  const [year, month, day] = date.split('-').map(Number);
  const start = new Date(year, month - 1, day);
  const end = new Date(year, month - 1, day + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

export class SupabaseStoreRepository implements StoreRepository {
  async listCategories(): Promise<StoreCategory[]> {
    const { data, error } = await getSupabaseClient()
      .from('store_categories')
      .select('id,name,sort_order')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });
    if (error) throw error;
    return (data ?? []).map((row) => mapCategory(row as CategoryRow));
  }

  async listStockItems(): Promise<StoreStockItem[]> {
    const { data, error } = await getSupabaseClient()
      .from('store_price_groups')
      .select('id,category_id,price_cents,stock_units,sort_order,photo_path,category:store_categories!inner(name),lots:store_stock_lots(remaining_units,unit_cost_cents)')
      .eq('is_active', true)
      .eq('store_categories.is_active', true)
      .order('sort_order', { ascending: true });
    if (error) throw error;

    return Promise.all((data ?? []).map(async (value) => {
      const row = value as unknown as StockGroupRow;
      const category = Array.isArray(row.category) ? row.category[0] : row.category;
      const lots = row.lots ?? [];
      const lotUnits = lots.reduce((sum, lot) => sum + lot.remaining_units, 0);
      const hasUnknownCost = lots.some((lot) => lot.remaining_units > 0 && lot.unit_cost_cents == null);
      const inventoryCostCents = lotUnits !== row.stock_units || hasUnknownCost
        ? null
        : nonnegativeTotal(lots.map((lot) => lot.remaining_units * Number(lot.unit_cost_cents ?? 0)));
      return {
        ...mapPriceGroup(row, await signedPhotoUrl(row.photo_path)),
        categoryName: category?.name ?? '',
        inventoryCostCents,
      };
    }));
  }

  async getDashboardSummary(categoryId?: number): Promise<StoreDashboardSummary> {
    const { data, error } = await getSupabaseClient().rpc('get_store_dashboard_summary', {
      p_category_id: categoryId ?? null,
    });
    if (error) throw error;
    const summary = data as { unitsSold: number | string; revenueCents: number | string; soldCostCents: number | string | null };
    return {
      unitsSold: Number(summary.unitsSold),
      revenueCents: Number(summary.revenueCents),
      soldCostCents: numberValue(summary.soldCostCents),
    };
  }

  async createCategory(input: CreateCategoryInput): Promise<StoreCategory> {
    const { data, error } = await getSupabaseClient().rpc('create_store_category', { p_name: input.name });
    if (error) throw error;
    const row = data as { id: number | string; name: string; sortOrder: number };
    return { id: Number(row.id), name: row.name, sortOrder: row.sortOrder };
  }

  async listPriceGroups(categoryId: number): Promise<StorePriceGroup[]> {
    const { data, error } = await getSupabaseClient()
      .from('store_price_groups')
      .select('id,category_id,price_cents,stock_units,sort_order,photo_path')
      .eq('category_id', categoryId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('price_cents', { ascending: true });
    if (error) throw error;
    return Promise.all((data ?? []).map((row) => mapPriceGroupWithPhoto(row as PriceGroupRow)));
  }

  async createPriceGroup(input: CreatePriceGroupInput): Promise<StorePriceGroup> {
    const businessId = input.photoDataUrl ? await getCurrentBusinessId() : null;
    const photoPath = input.photoDataUrl && businessId
      ? await uploadProductImage(input.photoDataUrl, businessId)
      : '';
    const { data, error } = await getSupabaseClient().rpc('create_store_price_group', {
      p_category_id: input.categoryId,
      p_price_cents: input.priceCents,
      p_photo_path: photoPath,
    });
    if (error) {
      if (photoPath) await removeProductImage(photoPath).catch(() => undefined);
      throw error;
    }
    return mapRpcPriceGroup(data as RpcPriceGroup);
  }

  async receiveStock(input: ReceiveStockInput): Promise<StorePriceGroup> {
    const { data, error } = await getSupabaseClient().rpc('receive_store_stock', {
      p_price_group_id: input.priceGroupId,
      p_units: input.units,
      p_supplier_id: input.supplierId,
      p_note: input.note,
      p_unit_cost_cents: input.unitCostCents ?? null,
    });
    if (error) throw error;
    return mapRpcPriceGroup(data as RpcPriceGroup);
  }

  async addStock(input: AddStoreStockInput): Promise<StorePriceGroup> {
    const businessId = input.photoDataUrl ? await getCurrentBusinessId() : null;
    const photoPath = input.photoDataUrl && businessId
      ? await uploadProductImage(input.photoDataUrl, businessId)
      : null;
    const { data, error } = await getSupabaseClient().rpc('add_store_stock', {
      p_category_id: input.categoryId,
      p_price_cents: input.priceCents,
      p_units: input.units,
      p_unit_cost_cents: input.unitCostCents ?? null,
      p_photo_path: photoPath,
    });
    if (error) {
      if (photoPath) await removeProductImage(photoPath).catch(() => undefined);
      throw error;
    }
    return mapRpcPriceGroup(data as RpcPriceGroup);
  }

  async completeSale(input: CompleteSaleInput): Promise<SaleReceipt> {
    const normalized = normalizeSale(input);
    const { data, error } = await getSupabaseClient().rpc('complete_store_sale', {
      p_items: normalized.items,
      p_request_id: normalized.requestId,
    });
    if (error) throw error;
    return mapSaleReceipt(data as RpcSaleReceipt);
  }

  async getTodaySummary(date: string): Promise<TodaySalesSummary> {
    const { start, end } = dateRange(date);
    const { data, error } = await getSupabaseClient().rpc('get_store_today_summary', {
      p_start: start,
      p_end: end,
    });
    if (error) throw error;

    const summary = data as {
      totalCents: number | string;
      unitsSold: number | string;
      costTotalCents: number | string | null;
      profitCents: number | string | null;
    };
    return {
      totalCents: Number(summary.totalCents),
      unitsSold: Number(summary.unitsSold),
      costTotalCents: numberValue(summary.costTotalCents),
      profitCents: numberValue(summary.profitCents),
    };
  }

  async listRecentMovements(limit = 30): Promise<StockMovement[]> {
    const normalizedLimit = Math.min(100, Math.max(1, Math.floor(limit)));
    const { data, error } = await getSupabaseClient()
      .from('store_stock_movements')
      .select('id,movement_type,units_delta,supplier_id,note,created_at,cost_total_cents,charged_total_cents,price_group:store_price_groups!inner(price_cents,category:store_categories!inner(name)),supplier:suppliers(name)')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(normalizedLimit);
    if (error) throw error;

    return (data ?? []).map((value) => {
      const row = value as unknown as MovementRow;
      const group = Array.isArray(row.price_group) ? row.price_group[0] : row.price_group;
      const category = Array.isArray(group.category) ? group.category[0] : group.category;
      const supplier = Array.isArray(row.supplier) ? row.supplier[0] : row.supplier;
      return {
        id: Number(row.id),
        categoryName: category?.name ?? '',
        priceCents: Number(group.price_cents),
        movementType: row.movement_type,
        unitsDelta: row.units_delta,
        supplierName: supplier?.name ?? null,
        note: row.note,
        createdAt: row.created_at,
        costTotalCents: numberValue(row.cost_total_cents),
        chargedTotalCents: numberValue(row.charged_total_cents),
      };
    });
  }
}
