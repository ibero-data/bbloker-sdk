interface Window {
  count: number;
  resetAt: number;
}

export class RateLimiter {
  private windows = new Map<string, Window>();
  private maxRequests: number;
  private windowMs: number;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(maxRequests: number, windowMs: number) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;

    // Cleanup stale entries every 60s to prevent memory leak
    this.cleanupTimer = setInterval(() => this.cleanup(), 60_000);

    // Don't hold the process open
    if (this.cleanupTimer?.unref) {
      this.cleanupTimer.unref();
    }
  }

  /** Returns true if the IP has exceeded the rate limit */
  isExceeded(ip: string): boolean {
    const now = Date.now();
    const window = this.windows.get(ip);

    if (!window || now > window.resetAt) {
      this.windows.set(ip, { count: 1, resetAt: now + this.windowMs });
      return false;
    }

    window.count++;
    return window.count > this.maxRequests;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [ip, window] of this.windows) {
      if (now > window.resetAt) {
        this.windows.delete(ip);
      }
    }
  }

  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.windows.clear();
  }
}
