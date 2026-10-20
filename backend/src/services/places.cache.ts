type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

export function createTtlLruCache<T>(maxEntries: number, ttlMs: number) {
  const entries = new Map<string, CacheEntry<T>>();
  const inFlight = new Map<string, Promise<T>>();

  function get(key: string): T | undefined {
    const entry = entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      entries.delete(key);
      return undefined;
    }
    entries.delete(key);
    entries.set(key, entry);
    return entry.value;
  }

  function set(key: string, value: T): void {
    entries.delete(key);
    entries.set(key, { expiresAt: Date.now() + ttlMs, value });
    while (entries.size > maxEntries) entries.delete(entries.keys().next().value!);
  }

  function getOrCreate(key: string, loader: () => Promise<T>): Promise<T> {
    const cached = get(key);
    if (cached !== undefined) return Promise.resolve(cached);
    const pending = inFlight.get(key);
    if (pending) return pending;
    const request = loader().then((value) => {
      set(key, value);
      return value;
    }).finally(() => {
      inFlight.delete(key);
    });
    inFlight.set(key, request);
    return request;
  }

  return { get, set, getOrCreate };
}
