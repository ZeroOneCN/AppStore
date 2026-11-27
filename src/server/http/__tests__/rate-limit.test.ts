import { afterEach, describe, expect, it, vi } from "vitest";
import { enforceRateLimit } from "../rate-limit";

/** 每个用例使用独立键，避免进程内计数互相影响 */
function uniqueKey(name: string): string {
  return `${name}-${Math.random().toString(36).slice(2)}`;
}

describe("固定窗口限流", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("窗口内超过上限后拒绝并返回等待时间", () => {
    const key = uniqueKey("limit");
    expect(enforceRateLimit(key, 2, 60_000).allowed).toBe(true);
    expect(enforceRateLimit(key, 2, 60_000).allowed).toBe(true);

    const denied = enforceRateLimit(key, 2, 60_000);
    expect(denied.allowed).toBe(false);
    expect(denied.retryAfter).toBeGreaterThan(0);
  });

  it("窗口结束后重新计数", () => {
    vi.useFakeTimers();
    const key = uniqueKey("reset");
    expect(enforceRateLimit(key, 1, 1_000).allowed).toBe(true);
    expect(enforceRateLimit(key, 1, 1_000).allowed).toBe(false);

    vi.advanceTimersByTime(1_100);
    expect(enforceRateLimit(key, 1, 1_000).allowed).toBe(true);
  });

  it("不同键互不影响", () => {
    const first = uniqueKey("a");
    const second = uniqueKey("b");
    expect(enforceRateLimit(first, 1, 60_000).allowed).toBe(true);
    expect(enforceRateLimit(first, 1, 60_000).allowed).toBe(false);
    expect(enforceRateLimit(second, 1, 60_000).allowed).toBe(true);
  });
});
