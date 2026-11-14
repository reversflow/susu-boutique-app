import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toIsoDate } from '../../../core/utils/date';

const { getTestDatabase, setTestDatabase } = vi.hoisted(() => {
  let testDatabase: any;
  return {
    getTestDatabase: () => testDatabase,
    setTestDatabase: (database: any) => { testDatabase = database; },
  };
});

vi.mock('../../../core/storage/sqlite', () => ({
  withDatabaseAccess: (operation: (database: any) => Promise<unknown>) =>
    operation(getTestDatabase()),
}));

import { SQLiteStoreRepository } from './SQLiteStoreRepository';

describe('SQLiteStoreRepository', () => {
  let database: DatabaseSync;
  const repository = new SQLiteStoreRepository();

  beforeEach(() => {
    database = new DatabaseSync(':memory:');
    database.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE suppliers (id INTEGER PRIMARY KEY, name TEXT NOT NULL);
      CREATE TABLE store_categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        sort_order INTEGER NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1
      );
      CREATE TABLE store_price_groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category_id INTEGER NOT NULL REFERENCES store_categories(id) ON DELETE RESTRICT,
        price_cents INTEGER NOT NULL,
        stock_units INTEGER NOT NULL DEFAULT 0,
        sort_order INTEGER NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        photo_data_url TEXT NOT NULL DEFAULT '',
        UNIQUE (category_id, price_cents)
      );
      CREATE TABLE store_sales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sold_at TEXT NOT NULL,
        total_cents INTEGER NOT NULL,
        request_id TEXT UNIQUE,
        request_payload TEXT
      );
      CREATE TABLE store_sale_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sale_id INTEGER NOT NULL REFERENCES store_sales(id) ON DELETE CASCADE,
        price_group_id INTEGER NOT NULL REFERENCES store_price_groups(id) ON DELETE RESTRICT,
        units_sold INTEGER NOT NULL,
        unit_price_cents INTEGER NOT NULL,
        base_unit_price_cents INTEGER NOT NULL,
        cost_total_cents INTEGER,
        total_cents INTEGER NOT NULL
      );
      CREATE TABLE store_stock_movements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        price_group_id INTEGER NOT NULL REFERENCES store_price_groups(id) ON DELETE RESTRICT,
        movement_type TEXT NOT NULL,
        units_delta INTEGER NOT NULL,
        supplier_id INTEGER,
        sale_id INTEGER REFERENCES store_sales(id) ON DELETE SET NULL,
        note TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        cost_total_cents INTEGER,
        charged_total_cents INTEGER
      );
      CREATE TABLE store_stock_lots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        price_group_id INTEGER NOT NULL REFERENCES store_price_groups(id),
        received_units INTEGER NOT NULL,
        remaining_units INTEGER NOT NULL,
        unit_cost_cents INTEGER,
        created_at TEXT NOT NULL
      );
      INSERT INTO suppliers (id, name) VALUES (7, 'Proveedor Uno');
      INSERT INTO store_categories (id, name, sort_order) VALUES (1, 'Anillos', 0);
      INSERT INTO store_price_groups (id, category_id, price_cents, stock_units, sort_order)
        VALUES (1, 1, 300, 0, 0);
    `);

    setTestDatabase({
      getAllAsync: async (sql: string, parameters: Array<string | number> = []) =>
        database.prepare(sql).all(...parameters),
      getFirstAsync: async (sql: string, parameters: Array<string | number> = []) =>
        database.prepare(sql).get(...parameters),
      runAsync: async (sql: string, parameters: Array<string | number | null> = []) => {
        const result = database.prepare(sql).run(...parameters);
        return { lastInsertRowId: Number(result.lastInsertRowid) };
      },
      withTransactionAsync: async (operation: () => Promise<void>) => {
        database.exec('BEGIN IMMEDIATE;');
        try {
          await operation();
          database.exec('COMMIT;');
        } catch (error) {
          database.exec('ROLLBACK;');
          throw error;
        }
      },
    });
  });

  afterEach(() => {
    database.close();
    setTestDatabase(null);
  });

  it('summarizes all sales at charged prices and preserves unknown historical costs', async () => {
    await repository.receiveStock({ priceGroupId: 1, units: 4, supplierId: null, note: '', unitCostCents: 100 });
    await repository.completeSale({ priceGroupId: 1, units: 2, unitPriceCents: 200 });
    await expect(repository.getDashboardSummary()).resolves.toEqual({ unitsSold: 2, revenueCents: 400, soldCostCents: 200 });
    await repository.receiveStock({ priceGroupId: 1, units: 1, supplierId: null, note: '', unitCostCents: null });
    await repository.completeSale({ priceGroupId: 1, units: 3, unitPriceCents: 300 });
    await expect(repository.getDashboardSummary()).resolves.toEqual({ unitsSold: 5, revenueCents: 1300, soldCostCents: null });
  });

  it('scopes sales and costs to the selected category', async () => {
    database.exec(`
      INSERT INTO store_categories (id, name, sort_order) VALUES (2, 'Collares', 1);
      INSERT INTO store_price_groups (id, category_id, price_cents, stock_units, sort_order)
        VALUES (2, 2, 900, 0, 0);
    `);

    await repository.receiveStock({ priceGroupId: 1, units: 3, supplierId: null, note: '', unitCostCents: 100 });
    await repository.completeSale({ priceGroupId: 1, units: 2, unitPriceCents: 300 });
    await repository.receiveStock({ priceGroupId: 2, units: 2, supplierId: null, note: '', unitCostCents: null });
    await repository.completeSale({ priceGroupId: 2, units: 1, unitPriceCents: 900 });

    await expect(repository.getDashboardSummary()).resolves.toEqual({ unitsSold: 3, revenueCents: 1500, soldCostCents: null });
    await expect(repository.getDashboardSummary(1)).resolves.toEqual({ unitsSold: 2, revenueCents: 600, soldCostCents: 200 });
    await expect(repository.getDashboardSummary(2)).resolves.toEqual({ unitsSold: 1, revenueCents: 900, soldCostCents: null });
  });

  it('receives stock and records its supplier in the movement ledger', async () => {
    const updated = await repository.receiveStock({
      priceGroupId: 1,
      units: 8,
      supplierId: 7,
      note: 'Reposición',
    });

    expect(updated.stockUnits).toBe(8);
    await expect(repository.listRecentMovements()).resolves.toMatchObject([
      {
        categoryName: 'Anillos',
        movementType: 'entrada',
        unitsDelta: 8,
        supplierName: 'Proveedor Uno',
        note: 'Reposición',
      },
    ]);
  });

  it('adds units to the existing category and price group and preserves its example photo', async () => {
    const first = await repository.addStock({
      categoryId: 1,
      priceCents: 300,
      units: 6,
      photoDataUrl: 'data:image/jpeg;base64,example',
    });
    const second = await repository.addStock({
      categoryId: 1,
      priceCents: 300,
      units: 4,
      photoDataUrl: null,
    });
    const items = await repository.listStockItems();

    expect(first.id).toBe(second.id);
    expect(second.stockUnits).toBe(10);
    expect(items).toEqual([
      expect.objectContaining({
        categoryName: 'Anillos',
        priceCents: 300,
        stockUnits: 10,
        photoDataUrl: 'data:image/jpeg;base64,example',
      }),
    ]);
  });

  it('creates a new category/price group from the stock intake form', async () => {
    const created = await repository.addStock({
      categoryId: 1,
      priceCents: 700,
      units: 12,
      photoDataUrl: 'data:image/png;base64,example',
    });

    expect(created).toMatchObject({
      categoryId: 1,
      priceCents: 700,
      stockUnits: 12,
      photoDataUrl: 'data:image/png;base64,example',
    });
    const rows = database.prepare('SELECT COUNT(*) AS count FROM store_price_groups').get() as { count: number };
    expect(rows.count).toBe(2);
  });

  it('records a sale, reduces stock, and calculates integer-cent totals atomically', async () => {
    await repository.receiveStock({ priceGroupId: 1, units: 5, supplierId: null, note: '' });

    const receipt = await repository.completeSale({ priceGroupId: 1, units: 2 });
    const group = await repository.listPriceGroups(1);
    const movements = await repository.listRecentMovements();

    expect(receipt).toMatchObject({
      unitsSold: 2,
      unitPriceCents: 300,
      totalCents: 600,
      remainingUnits: 3,
    });
    expect(group[0].stockUnits).toBe(3);
    expect(movements.map((movement) => movement.unitsDelta)).toEqual([-2, 5]);
  });

  it('exposes the remaining group stock after sales for the Store stock view', async () => {
    await repository.addStock({
      categoryId: 1,
      priceCents: 300,
      units: 20,
      photoDataUrl: 'data:image/png;base64,photo',
    });
    await repository.completeSale({ priceGroupId: 1, units: 18 });

    const stockItems = await repository.listStockItems();
    expect(stockItems[0]).toMatchObject({
      categoryName: 'Anillos',
      stockUnits: 2,
    });
  });

  it('rejects overselling without changing stock or writing a sale', async () => {
    await expect(repository.completeSale({ priceGroupId: 1, units: 1 }))
      .rejects.toThrow('Solo quedan 0 unidades');

    const sales = database.prepare('SELECT COUNT(*) AS count FROM store_sales').get() as { count: number };
    const groups = await repository.listPriceGroups(1);
    expect(sales.count).toBe(0);
    expect(groups[0].stockUnits).toBe(0);
  });

  it('summarizes daily revenue and units', async () => {
    await repository.receiveStock({ priceGroupId: 1, units: 4, supplierId: null, note: '' });
    await repository.completeSale({ priceGroupId: 1, units: 3 });

    const summary = await repository.getTodaySummary(toIsoDate(new Date()));
    expect(summary).toEqual({ totalCents: 900, unitsSold: 3, costTotalCents: null, profitCents: null });
  });

  it('charges a negotiated necklace and base-price ring once, preserving both prices', async () => {
    await repository.receiveStock({ priceGroupId: 1, units: 5, supplierId: null, note: '' });
    database.exec(`INSERT INTO store_categories (id, name, sort_order) VALUES (2, 'Collares', 1);
      INSERT INTO store_price_groups (id, category_id, price_cents, stock_units, sort_order) VALUES (2, 2, 500, 5, 0);
      INSERT INTO store_stock_lots (price_group_id, received_units, remaining_units, created_at) VALUES (2, 5, 5, '2026-11-09');`);
    const input = { requestId: 'sale-test-123', items: [
      { priceGroupId: 2, units: 1, unitPriceCents: 300 }, { priceGroupId: 1, units: 1 },
    ] };
    const receipt = await repository.completeSale(input);
    expect(receipt).toMatchObject({ totalCents: 600, unitsSold: 2, items: [
      { baseUnitPriceCents: 500, unitPriceCents: 300 }, { baseUnitPriceCents: 300, unitPriceCents: 300 },
    ] });
    expect(await repository.getTodaySummary(toIsoDate(new Date()))).toEqual({ totalCents: 600, unitsSold: 2, costTotalCents: null, profitCents: null });
    expect((await repository.completeSale(input)).saleId).toBe(receipt.saleId);
    expect((await repository.listPriceGroups(1))[0].stockUnits).toBe(4);
    expect((await repository.listPriceGroups(2))[0]).toMatchObject({ priceCents: 500, stockUnits: 4 });
    await expect(repository.completeSale({ ...input, items: [{ priceGroupId: 1, units: 2 }] })).rejects.toThrow('otro carrito');
  });

  it('aggregates stock for one group at multiple agreed prices before writing', async () => {
    await repository.receiveStock({ priceGroupId: 1, units: 3, supplierId: null, note: '' });
    await expect(repository.completeSale({ requestId: 'stock-test-123', items: [
      { priceGroupId: 1, units: 2 }, { priceGroupId: 1, units: 2, unitPriceCents: 200 },
    ] })).rejects.toThrow('Solo quedan 3');
    expect(database.prepare('SELECT COUNT(*) AS count FROM store_sales').get()).toMatchObject({ count: 0 });
    const receipt = await repository.completeSale({ requestId: 'stock-test-456', items: [
      { priceGroupId: 1, units: 1 }, { priceGroupId: 1, units: 2, unitPriceCents: 200 },
    ] });
    expect(receipt).toMatchObject({ totalCents: 700, unitsSold: 3 });
    expect((await repository.listPriceGroups(1))[0].stockUnits).toBe(0);
    expect(database.prepare("SELECT units_delta FROM store_stock_movements WHERE movement_type = 'venta'").all()).toEqual([{ units_delta: -3 }]);
  });

  it('rolls back sale, items and stock when the movement write fails after inserts', async () => {
    await repository.receiveStock({ priceGroupId: 1, units: 3, supplierId: null, note: '' });
    database.exec(`CREATE TRIGGER fail_sale_movement BEFORE INSERT ON store_stock_movements
      WHEN NEW.movement_type = 'venta' BEGIN SELECT RAISE(ABORT, 'injected failure'); END;`);
    await expect(repository.completeSale({ priceGroupId: 1, units: 2 })).rejects.toThrow('injected failure');
    expect(database.prepare('SELECT COUNT(*) AS count FROM store_sales').get()).toMatchObject({ count: 0 });
    expect(database.prepare('SELECT COUNT(*) AS count FROM store_sale_items').get()).toMatchObject({ count: 0 });
    expect((await repository.listPriceGroups(1))[0].stockUnits).toBe(3);
    expect(database.prepare('SELECT SUM(remaining_units) AS remaining FROM store_stock_lots').get()).toMatchObject({ remaining: 3 });
  });

  it('rejects invalid amounts and unsafe totals without writing', async () => {
    await repository.receiveStock({ priceGroupId: 1, units: 3, supplierId: null, note: '' });
    for (const amount of [0, -1, NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      await expect(repository.completeSale({ priceGroupId: 1, units: 1, unitPriceCents: amount })).rejects.toThrow();
    }
    await expect(repository.completeSale({ priceGroupId: 1, units: 2, unitPriceCents: Number.MAX_SAFE_INTEGER })).rejects.toThrow();
    expect(database.prepare('SELECT COUNT(*) AS count FROM store_sales').get()).toMatchObject({ count: 0 });
  });

  it('uses exact FIFO costs across batches and reports a loss on the negotiated charged price', async () => {
    await repository.receiveStock({ priceGroupId: 1, units: 2, supplierId: null, note: '', unitCostCents: 400 });
    await repository.receiveStock({ priceGroupId: 1, units: 3, supplierId: null, note: '', unitCostCents: 200 });
    expect((await repository.listStockItems())[0].inventoryCostCents).toBe(1400);
    const input = { requestId: 'fifo-sale-123', items: [
      { priceGroupId: 1, units: 1, unitPriceCents: 250 }, { priceGroupId: 1, units: 2, unitPriceCents: 250 },
    ] };
    const receipt = await repository.completeSale(input);
    expect(receipt).toMatchObject({ totalCents: 750, costTotalCents: 1000, profitCents: -250,
      items: [{ costTotalCents: 400 }, { costTotalCents: 600 }] });
    expect((await repository.listStockItems())[0]).toMatchObject({ stockUnits: 2, inventoryCostCents: 400 });
    expect(await repository.completeSale(input)).toMatchObject({ saleId: receipt.saleId, costTotalCents: 1000, profitCents: -250 });
    expect(database.prepare('SELECT remaining_units FROM store_stock_lots ORDER BY id').all())
      .toEqual([{ remaining_units: 0 }, { remaining_units: 2 }]);
    expect((await repository.listRecentMovements())[0]).toMatchObject({ chargedTotalCents: 750, costTotalCents: 1000 });
    expect(await repository.getTodaySummary(toIsoDate(new Date())))
      .toMatchObject({ totalCents: 750, costTotalCents: 1000, profitCents: -250 });
  });

  it('keeps unknown costs pending until old units are consumed and honors explicit free stock', async () => {
    await repository.receiveStock({ priceGroupId: 1, units: 1, supplierId: null, note: '' });
    await repository.receiveStock({ priceGroupId: 1, units: 2, supplierId: null, note: '', unitCostCents: 100 });
    expect((await repository.listStockItems())[0].inventoryCostCents).toBeNull();
    expect(await repository.completeSale({ priceGroupId: 1, units: 2 })).toMatchObject({ costTotalCents: null, profitCents: null });
    expect((await repository.listStockItems())[0].inventoryCostCents).toBe(100);
    expect(await repository.completeSale({ priceGroupId: 1, units: 1 })).toMatchObject({ costTotalCents: 100, profitCents: 200 });
    expect(await repository.getTodaySummary(toIsoDate(new Date()))).toMatchObject({ costTotalCents: null, profitCents: null });
    await repository.addStock({ categoryId: 1, priceCents: 300, units: 1, unitCostCents: 0, photoDataUrl: null });
    expect(await repository.completeSale({ priceGroupId: 1, units: 1 })).toMatchObject({ costTotalCents: 0, profitCents: 300 });
  });

  it('rejects fractional, negative and unsafe costs or stock additions without any partial writes', async () => {
    for (const cost of [-1, NaN, Infinity, 0.5, Number.MAX_SAFE_INTEGER]) {
      await expect(repository.receiveStock({ priceGroupId: 1, units: 2, supplierId: null, note: '', unitCostCents: cost })).rejects.toThrow();
    }
    database.exec(`UPDATE store_price_groups SET stock_units = ${Number.MAX_SAFE_INTEGER} WHERE id = 1;`);
    await expect(repository.receiveStock({ priceGroupId: 1, units: 1, supplierId: null, note: '', unitCostCents: 0 })).rejects.toThrow();
    expect(database.prepare('SELECT COUNT(*) AS count FROM store_stock_lots').get()).toMatchObject({ count: 0 });
  });

  it('rolls back already consumed FIFO lots and all other writes if a later lot update fails', async () => {
    await repository.receiveStock({ priceGroupId: 1, units: 1, supplierId: null, note: '', unitCostCents: 200 });
    await repository.receiveStock({ priceGroupId: 1, units: 1, supplierId: null, note: '', unitCostCents: 400 });
    database.exec(`CREATE TRIGGER fail_second_lot BEFORE UPDATE ON store_stock_lots
      WHEN OLD.id = 2 BEGIN SELECT RAISE(ABORT, 'injected lot failure'); END;`);
    await expect(repository.completeSale({ requestId: 'fifo-rollback', items: [{ priceGroupId: 1, units: 2 }] }))
      .rejects.toThrow('injected lot failure');
    expect(database.prepare('SELECT remaining_units FROM store_stock_lots ORDER BY id').all())
      .toEqual([{ remaining_units: 1 }, { remaining_units: 1 }]);
    expect(database.prepare('SELECT COUNT(*) AS count FROM store_sales').get()).toMatchObject({ count: 0 });
    expect(database.prepare('SELECT COUNT(*) AS count FROM store_sale_items').get()).toMatchObject({ count: 0 });
    expect((await repository.listPriceGroups(1))[0].stockUnits).toBe(2);
  });

  it('rejects a purchase that would make the remaining known stock value unsafe', async () => {
    await repository.receiveStock({ priceGroupId: 1, units: 1, supplierId: null, note: '', unitCostCents: Number.MAX_SAFE_INTEGER });
    await expect(repository.receiveStock({ priceGroupId: 1, units: 1, supplierId: null, note: '', unitCostCents: 1 })).rejects.toThrow();
    expect((await repository.listPriceGroups(1))[0].stockUnits).toBe(1);
    expect(database.prepare('SELECT COUNT(*) AS count FROM store_stock_lots').get()).toMatchObject({ count: 1 });
  });
});
