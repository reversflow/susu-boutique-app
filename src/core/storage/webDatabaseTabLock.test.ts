import { describe, expect, it, vi } from 'vitest';
import {
  createDatabaseTabLockAcquirer,
  isOpfsAccessHandleConflict,
  WebDatabaseTabLockUnavailableError,
} from './webDatabaseTabLock';

describe('createDatabaseTabLockAcquirer', () => {
  it('keeps one exclusive lock for the lifetime of the page', async () => {
    const request = vi.fn((_name, _options, callback) => {
      void callback({ name: 'susu-boutique-local-sqlite', mode: 'exclusive' });
      return new Promise<void>(() => undefined);
    });
    const acquire = createDatabaseTabLockAcquirer({ request } as unknown as LockManager);

    await expect(acquire()).resolves.toBe(true);
    await expect(acquire()).resolves.toBe(true);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('keeps the browser lock acquirer across Fast Refresh module reloads', async () => {
    const request = vi.fn((_name, _options, callback) => {
      void callback({ name: 'susu-boutique-local-sqlite', mode: 'exclusive' });
      return new Promise<void>(() => undefined);
    });
    vi.stubGlobal('navigator', { locks: { request } });

    try {
      const beforeRefresh = await import('./webDatabaseTabLock');
      await expect(beforeRefresh.acquireWebDatabaseTabLock()).resolves.toBe(true);

      vi.resetModules();
      const afterRefresh = await import('./webDatabaseTabLock');
      await expect(afterRefresh.acquireWebDatabaseTabLock()).resolves.toBe(true);

      expect(request).toHaveBeenCalledTimes(1);
    } finally {
      Reflect.deleteProperty(globalThis, '__susuBoutiqueDatabaseTabLockAcquirer');
      vi.unstubAllGlobals();
      vi.resetModules();
    }
  });

  it('waits for another tab to release the lock before acquiring it', async () => {
    let grantLock!: () => void;
    const request = vi.fn((_name, _options, callback) => {
      return new Promise<void>(() => {
        grantLock = () => {
          void callback({ name: 'susu-boutique-local-sqlite', mode: 'exclusive' });
        };
      });
    });
    const acquire = createDatabaseTabLockAcquirer({ request } as unknown as LockManager);

    const acquisition = acquire();
    await Promise.resolve();
    expect(request).toHaveBeenCalledTimes(1);
    grantLock();
    await expect(acquisition).resolves.toBe(true);
  });

  it('does not allow SQLite to open when Web Locks are unavailable', async () => {
    await expect(createDatabaseTabLockAcquirer(null)()).rejects.toBeInstanceOf(
      WebDatabaseTabLockUnavailableError,
    );
  });
});

describe('isOpfsAccessHandleConflict', () => {
  it('recognizes an OPFS access handle conflict', () => {
    expect(
      isOpfsAccessHandleConflict(
        new Error('Failed to execute createSyncAccessHandle: NoModificationAllowedError'),
      ),
    ).toBe(true);
  });

  it('does not classify unrelated database errors as a tab conflict', () => {
    expect(isOpfsAccessHandleConflict(new Error('Migration 3 failed'))).toBe(false);
  });
});
