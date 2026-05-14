/**
 * Server-side in-memory cache with request coalescing.
 *
 * Two guarantees:
 * 1. CACHE HIT  — if data was fetched less than TTL ms ago, return it instantly
 *                 with zero HANA connections.
 * 2. COALESCING — if two requests for the same key arrive simultaneously and
 *                 the cache is cold, only ONE HANA query runs; the second
 *                 request waits and shares the result of the first.
 *
 * This prevents the "burst" of 3-4 simultaneous HANA connections that happens
 * when the user changes the time window and all SWR hooks invalidate at once.
 */

const TTL_MS = 55_000; // match Cache-Control max-age on API routes

interface Entry<T> {
  data: T;
  at:   number;       // timestamp of last successful fetch
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const store   = new Map<string, Entry<any>>();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const inflight = new Map<string, Promise<any>>();

/**
 * Request coalescing WITHOUT in-memory storage.
 *
 * Use this for large datasets (system-logs, llm-logs) that must not be held
 * in the Node.js heap between requests — storing them causes OOM on CF.
 * Guarantee: if two requests for the same key arrive simultaneously while a
 * fetch is in progress, only ONE HANA query runs; both share the result.
 * Once delivered, the data is immediately eligible for GC.
 */
export async function coalesce<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  if (inflight.has(key)) {
    return inflight.get(key) as Promise<T>;
  }

  const promise = fetcher().finally(() => { inflight.delete(key); });
  inflight.set(key, promise);
  return promise;
}

export async function cached<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  // 1. Cache hit — return stored data if still fresh
  const entry = store.get(key);
  if (entry && Date.now() - entry.at < TTL_MS) {
    return entry.data as T;
  }

  // 2. Coalesce — if a fetch for this key is already running, wait for it
  if (inflight.has(key)) {
    return inflight.get(key) as Promise<T>;
  }

  // 3. Cold — start a new fetch, register it so concurrent callers can share it
  const promise = fetcher()
    .then((data) => {
      store.set(key, { data, at: Date.now() });
      return data;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, promise);
  return promise;
}
