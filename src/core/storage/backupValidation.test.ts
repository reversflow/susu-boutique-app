import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { validateBackupDatabase } from './backupValidation';
import { CURRENT_SCHEMA_VERSION, runMigrationsThrough } from './sqliteMigrations';

const databases: DatabaseSync[] = [];
const temporaryDirectories: string[] = [];

function createFixture(version: number): DatabaseSync {
  const database = new DatabaseSync(':memory:');
  databases.push(database);
  return database;
}

function adapter(database: DatabaseSync) {
  return {
    getFirstAsync: async <T>(source: string): Promise<T | null> =>
      (database.prepare(source).get() as T | undefined) ?? null,
    getAllAsync: async <T>(source: string): Promise<T[]> => database.prepare(source).all() as T[],
    execAsync: async (source: string): Promise<void> => {
      database.exec(source);
    },
  };
}

afterEach(() => {
  while (databases.length > 0) {
    databases.pop()?.close();
  }
  while (temporaryDirectories.length > 0) {
    rmSync(temporaryDirectories.pop()!, { force: true, recursive: true });
  }
});

describe('validateBackupDatabase', () => {
  it('accepts migration-source fixtures through the current schema', async () => {
    for (let version = 1; version <= CURRENT_SCHEMA_VERSION; version += 1) {
      const database = createFixture(version);
      const fixture = adapter(database);
      await runMigrationsThrough(fixture, version);

      await expect(validateBackupDatabase(fixture)).resolves.toBe(version);
    }
  });

  it.each([
    ['store_sale_items', 'base_unit_price_cents'],
    ['store_sales', 'request_payload'],
    ['store_sale_items', 'cost_total_cents'],
    ['store_stock_movements', 'charged_total_cents'],
    ['store_stock_lots', 'unit_cost_cents'],
  ])('rejects a current backup missing %s.%s', async (table, column) => {
    const database = createFixture(CURRENT_SCHEMA_VERSION);
    const fixture = adapter(database);
    await runMigrationsThrough(fixture);
    database.exec(`ALTER TABLE ${table} DROP COLUMN ${column};`);
    await expect(validateBackupDatabase(fixture)).rejects.toThrow('forma esperada');
  });

  it('rejects a current backup missing the purchase lots table', async () => {
    const database = createFixture(CURRENT_SCHEMA_VERSION);
    const fixture = adapter(database);
    await runMigrationsThrough(fixture);
    database.exec('DROP TABLE store_stock_lots;');
    await expect(validateBackupDatabase(fixture)).rejects.toThrow('tablas requeridas');
  });

  it('accepts the known defective v3 shape so v4 can repair it', async () => {
    const database = createFixture(3);
    const fixture = adapter(database);
    await runMigrationsThrough(fixture, 3);
    database.exec('ALTER TABLE daily_records DROP COLUMN net_profit;');

    await expect(validateBackupDatabase(fixture)).resolves.toBe(3);
  });

  it('rejects a corrupt SQLite file before schema inspection', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'appjorge-corrupt-'));
    temporaryDirectories.push(directory);
    const path = join(directory, 'corrupt.sqlite');
    writeFileSync(path, 'not a sqlite database');
    const database = new DatabaseSync(path);
    databases.push(database);

    await expect(validateBackupDatabase(adapter(database))).rejects.toThrow();
  });

  it('rejects foreign tables, future versions, and missing required columns', async () => {
    const foreign = createFixture(CURRENT_SCHEMA_VERSION);
    const foreignFixture = adapter(foreign);
    await runMigrationsThrough(foreignFixture);
    foreign.exec('CREATE TABLE foreign_data (id INTEGER PRIMARY KEY);');
    await expect(validateBackupDatabase(foreignFixture)).rejects.toThrow('tablas ajenas');

    const future = createFixture(CURRENT_SCHEMA_VERSION);
    const futureFixture = adapter(future);
    await runMigrationsThrough(futureFixture);
    future.exec(`PRAGMA user_version = ${CURRENT_SCHEMA_VERSION + 1};`);
    await expect(validateBackupDatabase(futureFixture)).rejects.toThrow('no compatible');

    const missing = createFixture(CURRENT_SCHEMA_VERSION);
    const missingFixture = adapter(missing);
    await runMigrationsThrough(missingFixture);
    missing.exec('ALTER TABLE suppliers DROP COLUMN created_at;');
    await expect(validateBackupDatabase(missingFixture)).rejects.toThrow('forma esperada');
  });
});
