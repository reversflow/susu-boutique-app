import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { CURRENT_SCHEMA_VERSION, runMigrations, runMigrationsThrough } from './sqliteMigrations';

describe('store schema migration', () => {
  let database: DatabaseSync | null = null;

  afterEach(() => {
    database?.close();
    database = null;
  });

  it('creates the local catalog and seeds the four store categories', async () => {
    database = new DatabaseSync(':memory:');
    const db = database;

    await runMigrations({
      getFirstAsync: async <T>(sql: string) => db.prepare(sql).get() as T | undefined ?? null,
      execAsync: async (sql: string) => db.exec(sql),
    });

    const categories = database.prepare(
      'SELECT name FROM store_categories ORDER BY sort_order ASC',
    ).all() as Array<{ name: string }>;
    const userVersion = database.prepare('PRAGMA user_version;').get() as { user_version: number };

    expect(categories.map((category) => category.name)).toEqual([
      'Anillos',
      'Collares',
      'Pulseras',
      'Pendientes',
    ]);
    expect(userVersion.user_version).toBe(CURRENT_SCHEMA_VERSION);
    const photoColumn = database.prepare('PRAGMA table_info(store_price_groups);').all()
      .find((column) => (column as { name: string }).name === 'photo_data_url');
    expect(photoColumn).toBeDefined();
  });

  it('preserves historical charged prices as their historical base and migrates once', async () => {
    database = new DatabaseSync(':memory:');
    const db = database;
    const adapter = {
      getFirstAsync: async <T>(sql: string) => db.prepare(sql).get() as T | undefined ?? null,
      execAsync: async (sql: string) => db.exec(sql),
    };
    await runMigrationsThrough(adapter, 11);
    db.exec(`INSERT INTO store_price_groups (id, category_id, price_cents, stock_units, sort_order) VALUES (1, 1, 700, 4, 0);
      INSERT INTO store_sales (id, sold_at, total_cents) VALUES (1, '2026-11-09T12:00:00', 1000);
      INSERT INTO store_sale_items (sale_id, price_group_id, units_sold, unit_price_cents, total_cents) VALUES (1, 1, 2, 500, 1000);`);
    await runMigrations(adapter);
    await runMigrations(adapter);
    expect(db.prepare('SELECT unit_price_cents, base_unit_price_cents, total_cents FROM store_sale_items').get())
      .toEqual({ unit_price_cents: 500, base_unit_price_cents: 500, total_cents: 1000 });
    expect(db.prepare('SELECT total_cents, request_id, request_payload FROM store_sales').get())
      .toEqual({ total_cents: 1000, request_id: null, request_payload: null });
    expect(db.prepare('SELECT stock_units, price_cents FROM store_price_groups').get())
      .toEqual({ stock_units: 4, price_cents: 700 });
    expect(db.prepare('SELECT received_units, remaining_units, unit_cost_cents FROM store_stock_lots').get())
      .toEqual({ received_units: 4, remaining_units: 4, unit_cost_cents: null });
    expect(db.prepare('SELECT cost_total_cents FROM store_sale_items').get()).toEqual({ cost_total_cents: null });
  });

  it('restores the four default jewel types when they are missing', async () => {
    database = new DatabaseSync(':memory:');
    const db = database;
    const adapter = {
      getFirstAsync: async <T>(sql: string) => db.prepare(sql).get() as T | undefined ?? null,
      execAsync: async (sql: string) => db.exec(sql),
    };

    await runMigrationsThrough(adapter, 13);
    db.exec('DELETE FROM store_categories');
    await runMigrations(adapter);

    const categories = db.prepare(
      'SELECT name FROM store_categories ORDER BY sort_order ASC',
    ).all() as Array<{ name: string }>;

    expect(categories.map((category) => category.name)).toEqual([
      'Anillos',
      'Collares',
      'Pulseras',
      'Pendientes',
    ]);
  });
});
