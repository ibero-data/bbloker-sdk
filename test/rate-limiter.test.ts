import { describe, it, expect, afterEach, vi } from "vitest";
import { RateLimiter } from "../src/core/rate-limiter";

describe("RateLimiter", () => {
  let limiter: RateLimiter;

  afterEach(() => {
    limiter?.destroy();
    vi.useRealTimers();
  });

  it("allows requests under the limit", () => {
    limiter = new RateLimiter(3, 60_000);
    expect(limiter.isExceeded("1.2.3.4")).toBe(false); // 1
    expect(limiter.isExceeded("1.2.3.4")).toBe(false); // 2
    expect(limiter.isExceeded("1.2.3.4")).toBe(false); // 3
  });

  it("blocks requests over the limit", () => {
    limiter = new RateLimiter(2, 60_000);
    limiter.isExceeded("1.2.3.4"); // 1
    limiter.isExceeded("1.2.3.4"); // 2
    expect(limiter.isExceeded("1.2.3.4")).toBe(true); // 3 — exceeds
  });

  it("tracks IPs independently", () => {
    limiter = new RateLimiter(1, 60_000);
    expect(limiter.isExceeded("1.1.1.1")).toBe(false);
    expect(limiter.isExceeded("2.2.2.2")).toBe(false);
    expect(limiter.isExceeded("1.1.1.1")).toBe(true); // second request for this IP
    expect(limiter.isExceeded("2.2.2.2")).toBe(true);
  });

  it("resets after window expires", () => {
    vi.useFakeTimers();
    limiter = new RateLimiter(1, 1_000);
    expect(limiter.isExceeded("1.2.3.4")).toBe(false);
    expect(limiter.isExceeded("1.2.3.4")).toBe(true);

    vi.advanceTimersByTime(1_001);
    expect(limiter.isExceeded("1.2.3.4")).toBe(false); // window reset
  });

  it("cleans up after destroy", () => {
    limiter = new RateLimiter(1, 60_000);
    limiter.isExceeded("1.2.3.4");
    limiter.destroy();
    // After destroy, internal state is cleared — no error thrown
  });
});
