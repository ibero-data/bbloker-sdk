import type { RuleSet } from "./types.js";
import defaultRules from "../data/default-rules.json" with { type: "json" };
import { logger } from "./logger";

export class RuleManager {
  private rules: RuleSet;
  private apiUrl: string;
  private apiKey: string;
  private syncTimer: ReturnType<typeof setInterval> | null = null;

  // Pre-compiled UA patterns for fast matching
  private uaPatterns: string[] = [];

  constructor(config: {
    apiUrl: string;
    apiKey: string;
    syncInterval: number;
  }) {
    this.apiUrl = config.apiUrl;
    this.apiKey = config.apiKey;
    this.rules = defaultRules as RuleSet;
    this.compilePatterns();

    // Start syncing rules from API
    this.sync(); // initial fetch (non-blocking)
    this.syncTimer = setInterval(() => this.sync(), config.syncInterval);
    if (this.syncTimer?.unref) {
      this.syncTimer.unref();
    }
  }

  private compilePatterns(): void {
    // Lowercase all UA patterns for case-insensitive matching
    this.uaPatterns = this.rules.blockedUAs.map((ua) => ua.toLowerCase());
  }

  get current(): RuleSet {
    return this.rules;
  }

  /** Check if a User-Agent matches any blocked pattern */
  isBlockedUA(ua: string): boolean {
    const lower = ua.toLowerCase();
    return this.uaPatterns.some((pattern) => lower.includes(pattern));
  }

  /** Check if an IP is in any blocked CIDR range */
  isBlockedIP(ip: string): boolean {
    return this.rules.blockedIPs.some((cidr) => ipInCidr(ip, cidr));
  }

  /** Calculate header anomaly score (0-1) */
  headerAnomalyScore(headers: Record<string, string>): number {
    let totalWeight = 0;
    let matchWeight = 0;

    for (const pattern of this.rules.headerPatterns) {
      totalWeight += pattern.weight;
      const value = headers[pattern.name.toLowerCase()] ?? "";
      try {
        if (new RegExp(pattern.pattern).test(value)) {
          matchWeight += pattern.weight;
        }
      } catch {
        // Invalid regex in rule, skip
      }
    }

    return totalWeight > 0 ? matchWeight / totalWeight : 0;
  }

  get anomalyThreshold(): number {
    return this.rules.anomalyThreshold;
  }

  private async sync(): Promise<void> {
    try {
      const res = await fetch(`${this.apiUrl}/v1/rules`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
        signal: AbortSignal.timeout(5_000),
      });

      if (!res.ok) {
        logger.warn(`bbloker: rule sync failed: ${res.status}`);
        return;
      }

      const data = (await res.json()) as RuleSet;

      // Only update if newer version
      if (data.version > this.rules.version) {
        this.rules = data;
        this.compilePatterns();
        logger.info(`bbloker: rules updated to v${data.version}`);
      }
    } catch {
      // Silent fail. We always have default rules.
      logger.debug("bbloker: rule sync error (using cached rules)");
    }
  }

  destroy(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }
}

// ---- CIDR matching ----

function ipToLong(ip: string): number {
  const parts = ip.split(".");
  if (parts.length !== 4) return 0;
  return (
    ((parseInt(parts[0]!, 10) << 24) |
      (parseInt(parts[1]!, 10) << 16) |
      (parseInt(parts[2]!, 10) << 8) |
      parseInt(parts[3]!, 10)) >>>
    0
  );
}

function ipInCidr(ip: string, cidr: string): boolean {
  // Skip IPv6 for now
  if (ip.includes(":")) return false;

  const [range, bits] = cidr.split("/");
  if (!range || !bits) return false;

  const mask = ~(2 ** (32 - parseInt(bits, 10)) - 1) >>> 0;
  const ipLong = ipToLong(ip);
  const rangeLong = ipToLong(range);

  return (ipLong & mask) === (rangeLong & mask);
}
