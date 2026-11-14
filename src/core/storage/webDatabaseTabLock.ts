const DATABASE_LOCK_NAME = 'susu-boutique-local-sqlite';
const GLOBAL_ACQUIRER_KEY = '__susuBoutiqueDatabaseTabLockAcquirer';

export class WebDatabaseTabLockUnavailableError extends Error {
  constructor() {
    super('Web Locks API is required to safely open the local database.');
    this.name = 'WebDatabaseTabLockUnavailableError';
  }
}

type LockManagerLike = Pick<LockManager, 'request'>;

type LockAcquirerHost = typeof globalThis & {
  [GLOBAL_ACQUIRER_KEY]?: () => Promise<boolean>;
};

export function createDatabaseTabLockAcquirer(lockManager: LockManagerLike | null) {
  let acquisition: Promise<boolean> | null = null;

  return () => {
    if (!lockManager) {
      return Promise.reject(new WebDatabaseTabLockUnavailableError());
    }

    if (acquisition) {
      return acquisition;
    }

    let resolveAcquisition!: (acquired: boolean) => void;
    let rejectAcquisition!: (error: unknown) => void;
    acquisition = new Promise<boolean>((resolve, reject) => {
      resolveAcquisition = resolve;
      rejectAcquisition = reject;
    });

    void Promise.resolve()
      .then(() =>
        lockManager.request(
          DATABASE_LOCK_NAME,
          { mode: 'exclusive' },
          () => {
            resolveAcquisition(true);
            // Keep the lock for this page's lifetime; OPFS SQLite handles are
            // exclusive and cannot be opened by another tab at the same time.
            return new Promise<void>(() => undefined);
          },
        ),
      )
      .catch((error: unknown) => {
        acquisition = null;
        rejectAcquisition(error);
      });

    return acquisition;
  };
}

function getBrowserLockAcquirer(): () => Promise<boolean> {
  const host = globalThis as LockAcquirerHost;
  if (!host[GLOBAL_ACQUIRER_KEY]) {
    const lockManager = typeof navigator === 'undefined' ? null : navigator.locks;
    host[GLOBAL_ACQUIRER_KEY] = createDatabaseTabLockAcquirer(lockManager);
  }

  return host[GLOBAL_ACQUIRER_KEY]!;
}

export function acquireWebDatabaseTabLock(): Promise<boolean> {
  return getBrowserLockAcquirer()();
}

export function isOpfsAccessHandleConflict(error: unknown): boolean {
  const seen = new Set<unknown>();
  let current: unknown = error;

  while (current && !seen.has(current)) {
    seen.add(current);
    const message = current instanceof Error ? current.message : String(current);
    if (message.includes('NoModificationAllowedError') || message.includes('createSyncAccessHandle')) {
      return true;
    }
    current = current instanceof Error ? current.cause : undefined;
  }

  return false;
}
