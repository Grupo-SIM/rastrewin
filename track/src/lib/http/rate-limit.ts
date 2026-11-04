/*
 * Rate limit em memória (token bucket) — o app roda num único container.
 * Para várias instâncias, troque por um armazenamento compartilhado mantendo esta interface.
 */

type Bucket = { tokens: number; updatedAt: number };

export type RateLimiter = {
  /** true = permitido; false = estourou o limite. */
  take(key: string): boolean;
};

const MAX_KEYS = 50_000;

export function createRateLimiter({ perMinute, burst = perMinute }: { perMinute: number; burst?: number }): RateLimiter {
  const buckets = new Map<string, Bucket>();
  const refillPerMs = perMinute / 60_000;

  return {
    take(key) {
      const now = Date.now();
      let bucket = buckets.get(key);
      if (!bucket) {
        if (buckets.size >= MAX_KEYS) {
          // descarta o mais antigo (Map mantém ordem de inserção)
          const oldest = buckets.keys().next().value;
          if (oldest !== undefined) buckets.delete(oldest);
        }
        bucket = { tokens: burst, updatedAt: now };
        buckets.set(key, bucket);
      } else {
        bucket.tokens = Math.min(burst, bucket.tokens + (now - bucket.updatedAt) * refillPerMs);
        bucket.updatedAt = now;
        // reinsere no fim (LRU simples)
        buckets.delete(key);
        buckets.set(key, bucket);
      }
      if (bucket.tokens < 1) return false;
      bucket.tokens -= 1;
      return true;
    },
  };
}
