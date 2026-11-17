/**
 * Límite de peticiones en memoria (ventana deslizante aproximada con dos ventanas fijas).
 * Suficiente para una instancia del gateway; con varias réplicas se movería a Redis.
 */
export function createRateLimiter({ limit, windowMs = 60000 }) {
  const buckets = new Map(); // key → { start, count, previous }

  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) if (now - bucket.start > 2 * windowMs) buckets.delete(key);
  }, windowMs);
  timer.unref();

  /** Devuelve { allowed, remaining, retryAfter } y cuenta la petición. */
  return function hit(key) {
    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { start: now, count: 0, previous: 0 };
      buckets.set(key, bucket);
    }
    if (now - bucket.start >= windowMs) {
      bucket.previous = now - bucket.start >= 2 * windowMs ? 0 : bucket.count;
      bucket.start += Math.floor((now - bucket.start) / windowMs) * windowMs;
      bucket.count = 0;
    }
    const elapsed = (now - bucket.start) / windowMs;
    const estimated = bucket.previous * (1 - elapsed) + bucket.count;
    if (estimated >= limit) {
      return { allowed: false, remaining: 0, retryAfter: Math.max(1, Math.ceil((windowMs - (now - bucket.start)) / 1000)) };
    }
    bucket.count += 1;
    return { allowed: true, remaining: Math.max(0, Math.floor(limit - estimated - 1)), retryAfter: 0 };
  };
}
