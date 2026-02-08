// ---- Configuration ----

export interface BblokerConfig {
  /** API key from bbloker dashboard (bb-sk-xxx) */
  apiKey: string;

  /** API endpoint. Default: https://bbloker.com */
  apiUrl?: string;

  /** Rule sync interval in ms. Default: 300_000 (5 min) */
  syncInterval?: number;

  /** Telemetry flush interval in ms. Default: 10_000 (10s) */
  flushInterval?: number;

  /** Max fingerprints to buffer before force flush. Default: 100 */
  bufferSize?: number;

  /** Enable telemetry reporting. Default: true */
  telemetry?: boolean;

  /** Rate limit: max requests per IP per window. Default: 60 */
  rateLimit?: number;

  /** Rate limit window in ms. Default: 60_000 (1 min) */
  rateLimitWindow?: number;

  /** Custom action on block. Default: return 403 */
  onBlock?: (ctx: BlockContext) => void | Response | Promise<void | Response>;

  /** Log level. Default: 'warn' */
  logLevel?: 'debug' | 'info' | 'warn' | 'error' | 'silent';

  /** Additional User-Agent substrings to always allow (skip all checks) */
  allowedUAs?: string[];
}

// ---- Internal types ----

export interface Fingerprint {
  /** Client IP */
  ip: string;
  /** Raw User-Agent */
  userAgent: string;
  /** Ordered list of header names */
  headerOrder: string[];
  /** Key headers for anomaly detection */
  headers: Record<string, string>;
  /** Request path */
  path: string;
  /** HTTP method */
  method: string;
  /** Timestamp */
  ts: number;
}

export interface Decision {
  action: 'allow' | 'block';
  reason?: string;
  /** Confidence 0-1 */
  confidence?: number;
}

export interface BlockContext {
  fingerprint: Fingerprint;
  decision: Decision;
}

// ---- Rules ----

export interface RuleSet {
  version: number;
  updatedAt: string;
  /** User-Agent substrings to always allow (skip all checks) */
  allowedUAs: string[];
  /** User-Agent substrings to block */
  blockedUAs: string[];
  /** CIDR ranges to block */
  blockedIPs: string[];
  /** Known bot header patterns */
  headerPatterns: HeaderPattern[];
  /** Header anomaly threshold (0-1). Above = block */
  anomalyThreshold: number;
}

export interface HeaderPattern {
  /** Header name to check */
  name: string;
  /** Regex pattern that indicates bot */
  pattern: string;
  /** Weight for anomaly scoring */
  weight: number;
}

// ---- Normalized request (adapter-agnostic) ----

export interface NormalizedRequest {
  ip: string;
  userAgent: string;
  headers: Record<string, string>;
  headerNames: string[];
  path: string;
  method: string;
}