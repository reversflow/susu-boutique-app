import type { SQLiteDatabase } from 'expo-sqlite';
import { withDatabaseAccess } from '../../../core/storage/sqlite';
import { toIsoDate } from '../../../core/utils/date';
import {
  AddStoreStockInput,
  CompleteSaleInput,
  CreateCategoryInput,
  CreatePriceGroupInput,
  ReceiveStockInput,
  SaleReceipt,
  SaleReceiptItem,
  StockMovement,
  StoreCategory,
  StorePriceGroup,
  StoreStockItem,
  TodaySalesSummary,
} from '../domain/types';
import { StoreRepository } from '../application/StoreRepository';
import { normalizeSale, positiveInteger, safeTotal } from '../domain/salePricing';
import { completeCost, consumeFifo, CostLot, nonnegativeTotal, validatePurchaseCost } from '../domain/stockCost';

type CategoryRow = {
  id: number;
  name: string;
  sort_order: number;
};

type PriceGroupRow = {
  id: number;
  category_id: number;
  price_cents: number;
  stock_units: number;
  sort_order: number;
  photo_data_url: string;
};

type StockItemRow = PriceGroupRow & {
  category_name: string;
  inventory_cost_cents?: number | null;
};

type StockMovementRow = {
  id: number;
  category_name: string;
  inventory_cost_cents?: number | null;
  price_cents: number;
  movement_type: StockMovement['movementType'];
  units_delta: number;
  supplier_name: string | null;
  note: string;
  created_at: string;
  cost_total_cents: number | null;
  charged_total_cents: number | null;
};

function mapCategory(row: CategoryRow): StoreCategory {
  return { id: row.id, name: row.name, sortOrder: row.sort_order };
}

function mapPriceGroup(row: PriceGroupRow): StorePriceGroup {
  return {
    id: row.id,
    categoryId: row.category_id,
    priceCents: row.price_cents,
    stockUnits: row.stock_units,
    sortOrder: row.sort_order,
    photoDataUrl: row.photo_data_url,
  };
}

function mapStockItem(row: StockItemRow): StoreStockItem {
  if (row.inventory_cost_cents != null) nonnegativeTotal([row.inventory_cost_cents]);
  return { ...mapPriceGroup(row), categoryName: row.category_name, inventoryCostCents: row.inventory_cost_cents ?? null };
}

function mapStockMovement(row: StockMovementRow): StockMovement {
  return {
    id: row.id,
    categoryName: row.category_name,
    priceCents: row.price_cents,
    movementType: row.movement_type,
    unitsDelta: row.units_delta,
    supplierName: row.supplier_name,
    note: row.note,
    createdAt: row.created_at,
    costTotalCents: row.cost_total_cents,
    chargedTotalCents: row.charged_total_cents,
  };
}

function localTimestamp(date = new Date()): string {
  const time = [date.getHours(), date.getMinutes(), date.getSeconds()]
    .map((part) => String(part).padStart(2, '0'))
    .join(':');
  return `${toIsoDate(date)}T${time}`;
}

async function createPurchaseLot(db: SQLiteDatabase, groupId: number, units: number, cost: number | null, createdAt: string): Promise<void> {
  const known = await db.getFirstAsync<{ known_cost: number }>(
    'SELECT COALESCE(SUM(remaining_units * unit_cost_cents), 0) AS known_cost FROM store_stock_lots WHERE price_group_id = ?', [groupId],
  );
  nonnegativeTotal([known?.known_cost ?? 0, cost === null ? 0 : cost * units]);
  await db.runAsync(`INSERT INTO store_stock_lots (price_group_id, received_units, remaining_units, unit_cost_cents, created_at)
    VALUES (?, ?, ?, ?, ?)`, [groupId, units, units, cost, createdAt]);
}

function saleProfit(total: number, items: SaleReceiptItem[]): number | null {
  const cost = completeCost(items.map((item) => item.costTotalCents));
  return cost === null ? null : total - cost;
}
export class SQLiteStoreRepository implements StoreRepository {
  async getDashboardSummary(categoryId?: number) {
    const where = categoryId == null ? '' : 'WHERE groups.category_id = ?';
    const parameters = categoryId == null ? [] : [categoryId];
    const row = await withDatabaseAccess((db) => db.getFirstAsync<{
      units_sold: number; revenue_cents: number; sold_cost_cents: number | null;
    }>(`SELECT COALESCE(SUM(units_sold), 0) AS units_sold,
              COALESCE(SUM(total_cents), 0) AS revenue_cents,
              CASE WHEN COUNT(*) != COUNT(cost_total_cents) THEN NULL
                   ELSE COALESCE(SUM(cost_total_cents), 0) END AS sold_cost_cents
       FROM store_sale_items AS items
       JOIN store_price_groups AS groups ON groups.id = items.price_group_id
       ${where}`, parameters));
    if (!row) throw new Error('No se pudo cargar el resumen de ventas.');
    nonnegativeTotal([row.units_sold, row.revenue_cents]);
    if (row.sold_cost_cents != null) nonnegativeTotal([row.sold_cost_cents]);
    return { unitsSold: row.units_sold, revenueCents: row.revenue_cents, soldCostCents: row.sold_cost_cents };
  }

  async listCategories(): Promise<StoreCategory[]> {
    const rows = await withDatabaseAccess((db) => db.getAllAsync<CategoryRow>(
      `SELECT id, name, sort_order
       FROM store_categories
       WHERE is_active = 1
       ORDER BY sort_order ASC, name COLLATE NOCASE ASC`,
    ));
    return rows.map(mapCategory);
  }

  async listStockItems(): Promise<StoreStockItem[]> {
    const rows = await withDatabaseAccess((db) => db.getAllAsync<StockItemRow>(
      `SELECT price_group.id, price_group.category_id, price_group.price_cents,
              price_group.stock_units, price_group.sort_order,
              price_group.photo_data_url, category.name AS category_name,
              CASE WHEN (SELECT COALESCE(SUM(lot.remaining_units), 0) FROM store_stock_lots AS lot WHERE lot.price_group_id = price_group.id) != price_group.stock_units
                     OR EXISTS (SELECT 1 FROM store_stock_lots AS lot WHERE lot.price_group_id = price_group.id AND lot.remaining_units > 0 AND lot.unit_cost_cents IS NULL)
                THEN NULL ELSE (SELECT COALESCE(SUM(lot.remaining_units * lot.unit_cost_cents), 0) FROM store_stock_lots AS lot WHERE lot.price_group_id = price_group.id) END AS inventory_cost_cents
       FROM store_price_groups AS price_group
       JOIN store_categories AS category ON category.id = price_group.category_id
       WHERE price_group.is_active = 1 AND category.is_active = 1
       ORDER BY category.sort_order ASC, category.name COLLATE NOCASE ASC,
                price_group.price_cents ASC`,
    ));
    return rows.map(mapStockItem);
  }

  async createCategory(input: CreateCategoryInput): Promise<StoreCategory> {
    return withDatabaseAccess(async (db) => {
      const order = await db.getFirstAsync<{ next_order: number }>(
        'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM store_categories',
      );
      const result = await db.runAsync(
        'INSERT INTO store_categories (name, sort_order) VALUES (?, ?)',
        [input.name, order?.next_order ?? 0],
      );
      return { id: result.lastInsertRowId, name: input.name, sortOrder: order?.next_order ?? 0 };
    });
  }

  async listPriceGroups(categoryId: number): Promise<StorePriceGroup[]> {
    const rows = await withDatabaseAccess((db) => db.getAllAsync<PriceGroupRow>(
      `SELECT id, category_id, price_cents, stock_units, sort_order, photo_data_url
       FROM store_price_groups
       WHERE category_id = ? AND is_active = 1
       ORDER BY sort_order ASC, price_cents ASC`,
      [categoryId],
    ));
    return rows.map(mapPriceGroup);
  }

  async createPriceGroup(input: CreatePriceGroupInput): Promise<StorePriceGroup> {
    return withDatabaseAccess(async (db) => {
      const order = await db.getFirstAsync<{ next_order: number }>(
        `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order
         FROM store_price_groups WHERE category_id = ?`,
        [input.categoryId],
      );
      const sortOrder = order?.next_order ?? 0;
      const result = await db.runAsync(
        `INSERT INTO store_price_groups (category_id, price_cents, sort_order, photo_data_url)
         VALUES (?, ?, ?, ?)`,
        [input.categoryId, input.priceCents, sortOrder, input.photoDataUrl ?? ''],
      );
      return {
        id: result.lastInsertRowId,
        categoryId: input.categoryId,
        priceCents: input.priceCents,
        stockUnits: 0,
        sortOrder,
        photoDataUrl: input.photoDataUrl ?? '',
      };
    });
  }

  async addStock(input: AddStoreStockInput): Promise<StorePriceGroup> {
    positiveInteger(input.units, 'Ingresá una cantidad entera mayor que cero.');
    positiveInteger(input.priceCents, 'El precio debe ser mayor que cero.');
    const purchaseTotal = validatePurchaseCost(input.unitCostCents, input.units);
    return withDatabaseAccess(async (db) => {
      let updatedGroup: StorePriceGroup | null = null;
      const createdAt = localTimestamp();

      await db.withTransactionAsync(async () => {
        const category = await db.getFirstAsync<{ id: number }>(
          'SELECT id FROM store_categories WHERE id = ? AND is_active = 1',
          [input.categoryId],
        );
        if (!category) throw new Error('El tipo de joya ya no está disponible.');

        const existing = await db.getFirstAsync<PriceGroupRow>(
          `SELECT id, category_id, price_cents, stock_units, sort_order, photo_data_url
           FROM store_price_groups
           WHERE category_id = ? AND price_cents = ? AND is_active = 1`,
          [input.categoryId, input.priceCents],
        );

        if (existing) {
          safeTotal([existing.stock_units, input.units]);
          const photoDataUrl = input.photoDataUrl ?? existing.photo_data_url;
          await db.runAsync(
            `UPDATE store_price_groups
             SET stock_units = stock_units + ?, photo_data_url = ?
             WHERE id = ?`,
            [input.units, photoDataUrl, existing.id],
          );
          await db.runAsync(
            `INSERT INTO store_stock_movements
              (price_group_id, movement_type, units_delta, note, created_at, cost_total_cents)
             VALUES (?, 'entrada', ?, '', ?, ?)`,
            [existing.id, input.units, createdAt, purchaseTotal],
          );
          await createPurchaseLot(db, existing.id, input.units, input.unitCostCents ?? null, createdAt);
          updatedGroup = mapPriceGroup({
            ...existing,
            stock_units: existing.stock_units + input.units,
            photo_data_url: photoDataUrl,
          });
          return;
        }

        const order = await db.getFirstAsync<{ next_order: number }>(
          `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order
           FROM store_price_groups WHERE category_id = ?`,
          [input.categoryId],
        );
        const sortOrder = order?.next_order ?? 0;
        const photoDataUrl = input.photoDataUrl ?? '';
        const result = await db.runAsync(
          `INSERT INTO store_price_groups
            (category_id, price_cents, stock_units, sort_order, photo_data_url)
           VALUES (?, ?, ?, ?, ?)`,
          [input.categoryId, input.priceCents, input.units, sortOrder, photoDataUrl],
        );
        await db.runAsync(
          `INSERT INTO store_stock_movements
            (price_group_id, movement_type, units_delta, note, created_at, cost_total_cents)
           VALUES (?, 'entrada', ?, '', ?, ?)`,
          [result.lastInsertRowId, input.units, createdAt, purchaseTotal],
        );
        await createPurchaseLot(db, result.lastInsertRowId, input.units, input.unitCostCents ?? null, createdAt);
        updatedGroup = {
          id: result.lastInsertRowId,
          categoryId: input.categoryId,
          priceCents: input.priceCents,
          stockUnits: input.units,
          sortOrder,
          photoDataUrl,
        };
      });

      if (!updatedGroup) throw new Error('No se pudo agregar el stock.');
      return updatedGroup;
    });
  }

  async receiveStock(input: ReceiveStockInput): Promise<StorePriceGroup> {
    positiveInteger(input.units, 'Ingresá una cantidad entera mayor que cero.');
    const purchaseTotal = validatePurchaseCost(input.unitCostCents, input.units);
    return withDatabaseAccess(async (db) => {
      let updatedGroup: StorePriceGroup | null = null;
      const createdAt = localTimestamp();

      await db.withTransactionAsync(async () => {
        const row = await db.getFirstAsync<PriceGroupRow>(
          `SELECT id, category_id, price_cents, stock_units, sort_order, photo_data_url
           FROM store_price_groups
           WHERE id = ? AND is_active = 1`,
          [input.priceGroupId],
        );
        if (!row) throw new Error('El grupo de precio ya no está disponible.');
        safeTotal([row.stock_units, input.units]);

        await db.runAsync(
          'UPDATE store_price_groups SET stock_units = stock_units + ? WHERE id = ?',
          [input.units, input.priceGroupId],
        );
        await db.runAsync(
          `INSERT INTO store_stock_movements
            (price_group_id, movement_type, units_delta, supplier_id, note, created_at, cost_total_cents)
           VALUES (?, 'entrada', ?, ?, ?, ?, ?)`,
          [input.priceGroupId, input.units, input.supplierId, input.note, createdAt, purchaseTotal],
        );
        await createPurchaseLot(db, input.priceGroupId, input.units, input.unitCostCents ?? null, createdAt);
        updatedGroup = mapPriceGroup({ ...row, stock_units: row.stock_units + input.units });
      });

      if (!updatedGroup) throw new Error('No se pudo actualizar el stock.');
      return updatedGroup;
    });
  }

  async completeSale(input: CompleteSaleInput): Promise<SaleReceipt> {
    const { items, requestId } = normalizeSale(input);
    const payload = JSON.stringify(items);
    return withDatabaseAccess(async (db) => {
      let receipt: SaleReceipt | null = null;
      const soldAt = localTimestamp();
      await db.withTransactionAsync(async () => {
        if (requestId) {
          const existing = await db.getFirstAsync<{ id: number; total_cents: number; request_payload: string }>(
            'SELECT id, total_cents, request_payload FROM store_sales WHERE request_id = ?', [requestId],
          );
          if (existing) {
            if (existing.request_payload !== payload) throw new Error('La referencia de venta ya se usó con otro carrito.');
            const stored = await db.getAllAsync<{
              price_group_id: number; units_sold: number; base_unit_price_cents: number;
              unit_price_cents: number; total_cents: number; stock_units: number; cost_total_cents: number | null;
            }>(`SELECT item.*, price_group.stock_units FROM store_sale_items AS item
                JOIN store_price_groups AS price_group ON price_group.id = item.price_group_id
                WHERE item.sale_id = ? ORDER BY item.id`, [existing.id]);
            const receiptItems = stored.map((row) => ({ priceGroupId: row.price_group_id, units: row.units_sold,
              baseUnitPriceCents: row.base_unit_price_cents, unitPriceCents: row.unit_price_cents,
              totalCents: row.total_cents, remainingUnits: row.stock_units, costTotalCents: row.cost_total_cents }));
            receipt = { saleId: existing.id, totalCents: existing.total_cents,
              unitsSold: safeTotal(receiptItems.map((item) => item.units)),
              unitPriceCents: receiptItems[0].unitPriceCents, remainingUnits: receiptItems[0].remainingUnits,
              items: receiptItems, costTotalCents: completeCost(receiptItems.map((item) => item.costTotalCents)),
              profitCents: saleProfit(existing.total_cents, receiptItems) };
            return;
          }
        }
        const groups = new Map<number, PriceGroupRow>();
        const requested = new Map<number, number>();
        for (const item of items) {
          requested.set(item.priceGroupId, safeTotal([requested.get(item.priceGroupId) ?? 0, item.units]));
        }
        for (const [groupId, units] of requested) {
          const group = await db.getFirstAsync<PriceGroupRow>(
            `SELECT price_group.* FROM store_price_groups AS price_group
             JOIN store_categories AS category ON category.id = price_group.category_id
             WHERE price_group.id = ? AND price_group.is_active = 1 AND category.is_active = 1`, [groupId],
          );
          if (!group) throw new Error('El grupo de precio ya no está disponible.');
          positiveInteger(group.price_cents, 'El precio base no es válido.');
          if (!Number.isSafeInteger(group.stock_units) || group.stock_units < units) {
            throw new Error(`Solo quedan ${group.stock_units} unidades disponibles.`);
          }
          groups.set(groupId, group);
        }
        const fifoLots = new Map<number, CostLot[]>();
        for (const groupId of requested.keys()) {
          const lots = await db.getAllAsync<CostLot>(
            'SELECT id, remaining_units, unit_cost_cents FROM store_stock_lots WHERE price_group_id = ? AND remaining_units > 0 ORDER BY id ASC', [groupId],
          );
          fifoLots.set(groupId, lots);
        }
        const receiptItems: SaleReceiptItem[] = items.map((item) => {
          const group = groups.get(item.priceGroupId)!;
          const unitPriceCents = item.unitPriceCents ?? group.price_cents;
          return { priceGroupId: item.priceGroupId, units: item.units, baseUnitPriceCents: group.price_cents,
            unitPriceCents, totalCents: safeTotal([unitPriceCents * item.units]),
            costTotalCents: consumeFifo(fifoLots.get(item.priceGroupId)!, item.units),
            remainingUnits: group.stock_units - requested.get(item.priceGroupId)! };
        });
        const totalCents = safeTotal(receiptItems.map((item) => item.totalCents));
        safeTotal(receiptItems.map((item) => item.baseUnitPriceCents * item.units));
        const unitsSold = safeTotal(receiptItems.map((item) => item.units));
        const costTotalCents = completeCost(receiptItems.map((item) => item.costTotalCents));
        const sale = await db.runAsync(
          'INSERT INTO store_sales (sold_at, total_cents, request_id, request_payload) VALUES (?, ?, ?, ?)',
          [soldAt, totalCents, requestId, requestId ? payload : null],
        );
        for (const item of receiptItems) {
          await db.runAsync(
            `INSERT INTO store_sale_items
              (sale_id, price_group_id, units_sold, unit_price_cents, total_cents, base_unit_price_cents, cost_total_cents)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [sale.lastInsertRowId, item.priceGroupId, item.units, item.unitPriceCents, item.totalCents, item.baseUnitPriceCents, item.costTotalCents ?? null],
          );
        }
        for (const [groupId, units] of requested) {
          await db.runAsync('UPDATE store_price_groups SET stock_units = stock_units - ? WHERE id = ?', [units, groupId]);
          const lines = receiptItems.filter((item) => item.priceGroupId === groupId);
          await db.runAsync(
            `INSERT INTO store_stock_movements (price_group_id, movement_type, units_delta, sale_id, created_at, cost_total_cents, charged_total_cents)
             VALUES (?, 'venta', ?, ?, ?, ?, ?)`, [groupId, -units, sale.lastInsertRowId, soldAt,
              completeCost(lines.map((item) => item.costTotalCents)), safeTotal(lines.map((item) => item.totalCents))],
          );
          for (const lot of fifoLots.get(groupId)!) {
            await db.runAsync('UPDATE store_stock_lots SET remaining_units = ? WHERE id = ?', [lot.remaining_units, lot.id]);
          }
        }
        receipt = { saleId: sale.lastInsertRowId, unitsSold, totalCents, items: receiptItems, costTotalCents, profitCents: saleProfit(totalCents, receiptItems),
          unitPriceCents: receiptItems[0].unitPriceCents, remainingUnits: receiptItems[0].remainingUnits };
      });
      if (!receipt) throw new Error('No se pudo registrar la venta.');
      return receipt;
    });
  }
  async getTodaySummary(date: string): Promise<TodaySalesSummary> {
    const row = await withDatabaseAccess((db) => db.getFirstAsync<{
      total_cents: number | null;
      units_sold: number | null;
      cost_total_cents: number | null;
    }>(
      `SELECT COALESCE(SUM(item.total_cents), 0) AS total_cents,
              COALESCE(SUM(item.units_sold), 0) AS units_sold,
              CASE WHEN COUNT(item.id) != COUNT(item.cost_total_cents) THEN NULL ELSE COALESCE(SUM(item.cost_total_cents), 0) END AS cost_total_cents
       FROM store_sales AS sale
       LEFT JOIN store_sale_items AS item ON item.sale_id = sale.id
       WHERE substr(sale.sold_at, 1, 10) = ?`,
      [date],
    ));

    return {
      totalCents: row?.total_cents ?? 0,
      unitsSold: row?.units_sold ?? 0,
      costTotalCents: row?.cost_total_cents ?? null,
      profitCents: row?.cost_total_cents == null ? null : (row?.total_cents ?? 0) - row.cost_total_cents,
    };
  }

  async listRecentMovements(limit = 30): Promise<StockMovement[]> {
    const normalizedLimit = Math.min(100, Math.max(1, Math.floor(limit)));
    const rows = await withDatabaseAccess((db) => db.getAllAsync<StockMovementRow>(
      `SELECT movement.id,
              category.name AS category_name,
              price_group.price_cents,
              movement.movement_type,
              movement.units_delta,
              supplier.name AS supplier_name,
              movement.note,
              movement.cost_total_cents, movement.charged_total_cents,
              movement.created_at
       FROM store_stock_movements AS movement
       JOIN store_price_groups AS price_group ON price_group.id = movement.price_group_id
       JOIN store_categories AS category ON category.id = price_group.category_id
       LEFT JOIN suppliers AS supplier ON supplier.id = movement.supplier_id
       ORDER BY movement.created_at DESC, movement.id DESC
       LIMIT ?`,
      [normalizedLimit],
    ));
    return rows.map(mapStockMovement);
  }
}
