import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';
import { runMigrations } from './sqliteMigrations';
import {
  advanceDatabaseGeneration,
  blockDatabaseOperations,
  getDatabaseGeneration,
  runDatabaseOperation,
  subscribeDatabaseGeneration,
} from './databaseCoordinator';

// Keep browser previews isolated from persistent OPFS data while the backend is local.
const USE_IN_MEMORY_WEB_DATABASE = Platform.OS === 'web' && __DEV__;
const DB_NAME = USE_IN_MEMORY_WEB_DATABASE ? ':memory:' : 'susu-boutique.db';

let singletonDb: SQLite.SQLiteDatabase | null = null;
let initialized = false;
let initializationPromise: Promise<void> | null = null;

async function getSingletonDb(): Promise<SQLite.SQLiteDatabase> {
  if (!singletonDb) {
    singletonDb = await SQLite.openDatabaseAsync(DB_NAME);
  }

  return singletonDb;
}

export async function initializeDatabase(): Promise<void> {
  await withDatabaseAccess(async () => undefined);
}

async function initializeDatabaseUnsafe(db: SQLite.SQLiteDatabase): Promise<void> {
  if (initialized) {
    return;
  }

  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    if (Platform.OS === 'web') {
      // Avoid extra OPFS files for SQLite temp indexes during schema migrations.
      await db.execAsync('PRAGMA temp_store = MEMORY;');
    }
    await runMigrations(db);
    initialized = true;
  })().catch((error) => {
    initializationPromise = null;
    throw error;
  });

  await initializationPromise;
}

export async function withDatabaseAccess<T>(
  operation: (db: SQLite.SQLiteDatabase) => Promise<T>,
): Promise<T> {
  return runDatabaseOperation(async () => {
    const db = await getSingletonDb();
    await initializeDatabaseUnsafe(db);
    return operation(db);
  });
}

export {
  advanceDatabaseGeneration,
  blockDatabaseOperations,
  getDatabaseGeneration,
  subscribeDatabaseGeneration,
};
