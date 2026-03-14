const CACHE_PREFIX = 'onblm-cache:v1:';
const MAX_PERSISTED_CHARS = 250_000;

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
  updatedAt: number;
};

const memoryCache = new Map<string, CacheEntry<unknown>>();
const inflightRequests = new Map<string, Promise<unknown>>();

const getStorage = () => {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

const fullKey = (key: string) => `${CACHE_PREFIX}${key}`;

const isExpired = (entry: CacheEntry<unknown>) => entry.expiresAt <= Date.now();

const readStorageEntry = <T,>(key: string): CacheEntry<T> | null => {
  const storage = getStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(fullKey(key));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry<T>;
    if (!parsed || typeof parsed !== 'object' || typeof parsed.expiresAt !== 'number') {
      storage.removeItem(fullKey(key));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

const writeStorageEntry = <T,>(key: string, entry: CacheEntry<T>) => {
  const storage = getStorage();
  if (!storage) return;
  try {
    const serialized = JSON.stringify(entry);
    if (serialized.length > MAX_PERSISTED_CHARS) {
      storage.removeItem(fullKey(key));
      return;
    }
    storage.setItem(fullKey(key), serialized);
  } catch {
    storage.removeItem(fullKey(key));
  }
};

export const getCachedValue = <T,>(key: string): T | null => {
  const memoryEntry = memoryCache.get(key) as CacheEntry<T> | undefined;
  if (memoryEntry) {
    if (!isExpired(memoryEntry)) return memoryEntry.value;
    memoryCache.delete(key);
  }

  const storageEntry = readStorageEntry<T>(key);
  if (!storageEntry) return null;
  if (isExpired(storageEntry)) {
    invalidateCache(key);
    return null;
  }
  memoryCache.set(key, storageEntry as CacheEntry<unknown>);
  return storageEntry.value;
};

export const setCachedValue = <T,>(key: string, value: T, ttlMs: number) => {
  const entry: CacheEntry<T> = {
    value,
    expiresAt: Date.now() + ttlMs,
    updatedAt: Date.now(),
  };
  memoryCache.set(key, entry as CacheEntry<unknown>);
  writeStorageEntry(key, entry);
  return value;
};

export const invalidateCache = (key: string) => {
  memoryCache.delete(key);
  const storage = getStorage();
  storage?.removeItem(fullKey(key));
};

export const invalidateCacheByPrefix = (prefix: string) => {
  for (const key of memoryCache.keys()) {
    if (key.startsWith(prefix)) memoryCache.delete(key);
  }
  const storage = getStorage();
  if (!storage) return;
  for (let i = storage.length - 1; i >= 0; i -= 1) {
    const key = storage.key(i);
    if (key && key.startsWith(fullKey(prefix))) {
      storage.removeItem(key);
    }
  }
};

export const fetchWithCache = async <T,>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>,
  options?: { force?: boolean; useStaleOnError?: boolean }
): Promise<T> => {
  if (!options?.force) {
    const cached = getCachedValue<T>(key);
    if (cached !== null) return cached;
  }

  const existing = inflightRequests.get(key) as Promise<T> | undefined;
  if (existing) return existing;

  const stale = readStorageEntry<T>(key) || (memoryCache.get(key) as CacheEntry<T> | undefined) || null;

  const request = fetcher()
    .then((value) => setCachedValue(key, value, ttlMs))
    .catch((error) => {
      if (options?.useStaleOnError && stale?.value != null) {
        return stale.value;
      }
      throw error;
    })
    .finally(() => {
      inflightRequests.delete(key);
    });

  inflightRequests.set(key, request as Promise<unknown>);
  return request;
};
