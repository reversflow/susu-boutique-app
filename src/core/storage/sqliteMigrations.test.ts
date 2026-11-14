import { describe, expect, it } from 'vitest';
import { CURRENT_SCHEMA_VERSION, runMigrations } from './sqliteMigrations';

class FakeDb {
  private version: number;
  readonly executedSql: string[] = [];
  shouldFail = false;
  netProfitColumnExists = false;
  dataphoneSalesColumnExists = false;
  supplierIdColumnExists = false;
  investmentTypeColumnExists = false;

  constructor(initialVersion: number) {
    this.version = initialVersion;
  }

  async getFirstAsync<T>(source: string): Promise<T | null> {
    this.executedSql.push(source.trim());
    if (source.includes('PRAGMA user_version')) {
      return { user_version: this.version } as T;
    }
    if (source.includes('pragma_table_info')) {
      if (source.includes("'net_profit'")) {
        return { hasColumn: this.netProfitColumnExists ? 1 : 0 } as T;
      }
      if (source.includes("'dataphone_sales'")) {
        return { hasColumn: this.dataphoneSalesColumnExists ? 1 : 0 } as T;
      }
      if (source.includes("'supplier_id'")) {
        return { hasColumn: this.supplierIdColumnExists ? 1 : 0 } as T;
      }
      if (source.includes("'type'")) {
        return { hasColumn: this.investmentTypeColumnExists ? 1 : 0 } as T;
      }
      return { hasColumn: 0 } as T;
    }

    return null;
  }

  async execAsync(source: string): Promise<void> {
    const normalized = source.trim();
    this.executedSql.push(normalized);

    if (normalized.startsWith('PRAGMA user_version =')) {
      const match = normalized.match(/PRAGMA user_version = (\d+);/);
      if (match) {
        this.version = Number(match[1]);
      }
    }

    if (this.shouldFail && normalized.includes('CREATE TABLE IF NOT EXISTS daily_records')) {
      throw new Error('boom');
    }
  }
}

describe('runMigrations', () => {
  it('runs pending migrations inside transaction and updates user_version', async () => {
    const db = new FakeDb(0);

    await runMigrations(db);

    expect(db.executedSql).toContain('BEGIN IMMEDIATE;');
    expect(db.executedSql).toContain('COMMIT;');
    expect(db.executedSql).toContain('PRAGMA user_version = 1;');
    expect(db.executedSql).toContain('PRAGMA user_version = 2;');
    expect(db.executedSql).toContain('PRAGMA user_version = 3;');
    expect(db.executedSql).toContain('PRAGMA user_version = 4;');
    expect(db.executedSql).toContain('PRAGMA user_version = 5;');
    expect(db.executedSql).toContain('PRAGMA user_version = 6;');
    expect(db.executedSql).toContain('PRAGMA user_version = 7;');
    expect(db.executedSql).toContain('PRAGMA user_version = 8;');
    expect(db.executedSql).toContain('PRAGMA user_version = 9;');
    expect(db.executedSql).toContain('PRAGMA user_version = 10;');
    expect(db.executedSql).toContain('PRAGMA user_version = 11;');
  });

  it('skips migrations when user_version is up to date', async () => {
    const db = new FakeDb(CURRENT_SCHEMA_VERSION);

    await runMigrations(db);

    expect(db.executedSql).toEqual(['PRAGMA user_version;']);
  });

  it('runs only pending migrations when partially migrated', async () => {
    const db = new FakeDb(1);

    await runMigrations(db);

    expect(db.executedSql.some((sql) => sql.includes('CREATE TABLE IF NOT EXISTS investment_adjustments'))).toBe(true);
    expect(db.executedSql).toContain('PRAGMA user_version = 2;');
    expect(db.executedSql).toContain('PRAGMA user_version = 3;');
    expect(db.executedSql).toContain('PRAGMA user_version = 4;');
    expect(db.executedSql).toContain('PRAGMA user_version = 5;');
    expect(db.executedSql).toContain('PRAGMA user_version = 6;');
    expect(db.executedSql).toContain('PRAGMA user_version = 7;');
    expect(db.executedSql).toContain('PRAGMA user_version = 8;');
    expect(db.executedSql).toContain('PRAGMA user_version = 9;');
    expect(db.executedSql).toContain('PRAGMA user_version = 10;');
    expect(db.executedSql).toContain('PRAGMA user_version = 11;');
    expect(db.executedSql.some((sql) => sql.includes('CREATE TABLE IF NOT EXISTS daily_records'))).toBe(false);
  });

  it('rolls back when migration fails', async () => {
    const db = new FakeDb(0);
    db.shouldFail = true;

    await expect(runMigrations(db)).rejects.toThrow('Migration 1 (create-daily-records-table) failed');
    expect(db.executedSql).toContain('ROLLBACK;');
  });

  it('reparar v4 agrega net_profit cuando falta', async () => {
    const db = new FakeDb(3);
    db.netProfitColumnExists = false;

    await runMigrations(db);

    expect(db.executedSql).toContain('PRAGMA user_version = 4;');
    expect(db.executedSql.some((sql) => sql.toLowerCase().includes('add column net_profit'))).toBe(true);
  });

  it('reparar v4 omite el ALTER cuando net_profit ya existe', async () => {
    const db = new FakeDb(3);
    db.netProfitColumnExists = true;

    await runMigrations(db);

    expect(db.executedSql).toContain('PRAGMA user_version = 4;');
    expect(db.executedSql.some((sql) => sql.toLowerCase().includes('add column net_profit'))).toBe(false);
  });

  it('v5 crea tabla holidays', async () => {
    const db = new FakeDb(4);

    await runMigrations(db);

    expect(db.executedSql).toContain('PRAGMA user_version = 5;');
    expect(db.executedSql.some((sql) => sql.includes('CREATE TABLE IF NOT EXISTS holidays'))).toBe(true);
  });

  it('v6 crea tabla suppliers', async () => {
    const db = new FakeDb(5);

    await runMigrations(db);

    expect(db.executedSql).toContain('PRAGMA user_version = 6;');
    expect(db.executedSql.some((sql) => sql.includes('CREATE TABLE IF NOT EXISTS suppliers'))).toBe(true);
  });

  it('v7 agrega dataphone_sales cuando falta', async () => {
    const db = new FakeDb(6);
    db.dataphoneSalesColumnExists = false;

    await runMigrations(db);

    expect(db.executedSql).toContain('PRAGMA user_version = 7;');
    expect(db.executedSql.some((sql) => sql.toLowerCase().includes('add column dataphone_sales'))).toBe(true);
  });

  it('v7 omite el ALTER cuando dataphone_sales ya existe', async () => {
    const db = new FakeDb(6);
    db.dataphoneSalesColumnExists = true;

    await runMigrations(db);

    expect(db.executedSql).toContain('PRAGMA user_version = 7;');
    expect(db.executedSql.some((sql) => sql.toLowerCase().includes('add column dataphone_sales'))).toBe(false);
  });

  it('v8 agrega supplier_id y type cuando faltan', async () => {
    const db = new FakeDb(7);
    db.supplierIdColumnExists = false;
    db.investmentTypeColumnExists = false;

    await runMigrations(db);

    expect(db.executedSql).toContain('PRAGMA user_version = 8;');
    expect(db.executedSql.some((sql) => sql.toLowerCase().includes('add column supplier_id'))).toBe(true);
    expect(db.executedSql.some((sql) => sql.toLowerCase().includes("add column type text"))).toBe(true);
  });

  it('v8 omite ALTERs cuando columnas ya existen', async () => {
    const db = new FakeDb(7);
    db.supplierIdColumnExists = true;
    db.investmentTypeColumnExists = true;

    await runMigrations(db);

    expect(db.executedSql).toContain('PRAGMA user_version = 8;');
    expect(db.executedSql.some((sql) => sql.toLowerCase().includes('add column supplier_id'))).toBe(false);
    expect(db.executedSql.some((sql) => sql.toLowerCase().includes("add column type text"))).toBe(false);
  });

  it('v10 creates the store catalog, sales, stock movement tables and default categories', async () => {
    const db = new FakeDb(9);

    await runMigrations(db);

    expect(db.executedSql).toContain('PRAGMA user_version = 10;');
    const migrationSql = db.executedSql.find((sql) => sql.includes('CREATE TABLE IF NOT EXISTS store_categories'));
    expect(migrationSql).toContain('CREATE TABLE IF NOT EXISTS store_price_groups');
    expect(migrationSql).toContain('CREATE TABLE IF NOT EXISTS store_sales');
    expect(migrationSql).toContain('CREATE TABLE IF NOT EXISTS store_sale_items');
    expect(migrationSql).toContain('CREATE TABLE IF NOT EXISTS store_stock_movements');
    expect(migrationSql).toContain("('Anillos', 0)");
    expect(migrationSql).toContain("('Pendientes', 3)");
  });

  it('v11 adds one representative photo per price group', async () => {
    const db = new FakeDb(10);

    await runMigrations(db);

    expect(db.executedSql).toContain('PRAGMA user_version = 11;');
    expect(db.executedSql.some((sql) => sql.includes('ADD COLUMN photo_data_url TEXT'))).toBe(true);
  });

  it('v14 restores the four default jewel types', async () => {
    const db = new FakeDb(13);

    await runMigrations(db);

    expect(db.executedSql).toContain('PRAGMA user_version = 14;');
    const migrationSql = db.executedSql.find((sql) => sql.includes('INSERT OR IGNORE INTO store_categories'));
    expect(migrationSql).toContain("('Anillos', 0)");
    expect(migrationSql).toContain("('Collares', 1)");
    expect(migrationSql).toContain("('Pulseras', 2)");
    expect(migrationSql).toContain("('Pendientes', 3)");
  });
});
