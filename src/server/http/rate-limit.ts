/** 限流结果 */
export interface RateLimitResult {
  /** 是否允许本次请求 */
  allowed: boolean;
  /** 剩余可用次数 */
  remaining: number;
  /** 需要等待的秒数，仅在拒绝时大于 0 */
  retryAfter: number;
}

/** 固定窗口计数桶 */
interface Bucket {
  count: number;
  resetAt: number;
}

/** 进程内计数缓存，适用于单实例部署 */
const buckets = new Map<string, Bucket>();

/**
 * 固定窗口限流：按 key 在窗口内累计次数，超限拒绝。
 * @param key 限流键，如 IP + 接口名
 * @param limit 窗口内允许的最大次数
 * @param windowMs 窗口长度（毫秒）
 * @returns 限流结果
 */
export function enforceRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfter: 0 };
  }

  if (bucket.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }

  bucket.count += 1;

  // 定期清理过期桶，避免长期运行后缓存膨胀
  if (buckets.size > 10_000) {
    for (const [entryKey, entry] of buckets) {
      if (entry.resetAt <= now) buckets.delete(entryKey);
    }
  }

  return { allowed: true, remaining: limit - bucket.count, retryAfter: 0 };
}
