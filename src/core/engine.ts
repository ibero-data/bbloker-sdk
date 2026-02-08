import type {
  BblokerConfig,
  NormalizedRequest,
  Fingerprint,
  Decision,
} from './types';
import { RuleManager } from './rules';
import { RateLimiter } from './rate-limiter';
import { Telemetry } from './telemetry';
import { logger } from './logger';

const DEFAULTS = {
  apiUrl: 'https://bbloker.com',
  syncInterval: 300_000,
  flushInterval: 10_000,
  bufferSize: 100,
  telemetry: true,
  rateLimit: 60,
  rateLimitWindow: 60_000,
  logLevel: 'warn' as const,
};

export class Bbloker {
  private rules: RuleManager;
  private rateLimiter: RateLimiter;
  private telemetry: Telemetry;
  private config: Required<
    Pick<
      BblokerConfig,
      'apiKey' | 'apiUrl' | 'rateLimit' | 'rateLimitWindow' | 'logLevel'
    >
  > & { onBlock?: BblokerConfig['onBlock'] };

  constructor(config: BblokerConfig) {
    if (!config.apiKey) {
      throw new Error('bbloker: apiKey is required');
    }

    const apiUrl = config.apiUrl ?? DEFAULTS.apiUrl;
    const syncInterval = config.syncInterval ?? DEFAULTS.syncInterval;
    const flushInterval = config.flushInterval ?? DEFAULTS.flushInterval;
    const bufferSize = config.bufferSize ?? DEFAULTS.bufferSize;
    const telemetryEnabled = config.telemetry ?? DEFAULTS.telemetry;
    const rateLimit = config.rateLimit ?? DEFAULTS.rateLimit;
    const rateLimitWindow = config.rateLimitWindow ?? DEFAULTS.rateLimitWindow;
    const logLevel = config.logLevel ?? DEFAULTS.logLevel;

    this.config = {
      apiKey: config.apiKey,
      apiUrl,
      rateLimit,
      rateLimitWindow,
      logLevel,
      onBlock: config.onBlock,
    };

    logger.setLevel(logLevel);

    this.rules = new RuleManager({
      apiUrl,
      apiKey: config.apiKey,
      syncInterval,
      allowedUAs: config.allowedUAs,
    });

    this.rateLimiter = new RateLimiter(rateLimit, rateLimitWindow);

    this.telemetry = new Telemetry({
      apiUrl,
      apiKey: config.apiKey,
      flushInterval,
      bufferSize,
      enabled: telemetryEnabled,
    });

    logger.info('bbloker: initialized');
  }

  /**
   * Analyze a normalized request and return a block/allow decision.
   * This is the core method — adapters call this.
   */
  analyze(req: NormalizedRequest): Decision {
    // 1. UA whitelist — if allowed and NOT also in blocklist, skip all checks
    if (
      req.userAgent &&
      this.rules.isAllowedUA(req.userAgent) &&
      !this.rules.isBlockedUA(req.userAgent)
    ) {
      const decision: Decision = { action: 'allow', reason: 'allowed_ua' };
      this.report(req, decision);
      return decision;
    }

    // 2. Check User-Agent against known bot list
    if (req.userAgent && this.rules.isBlockedUA(req.userAgent)) {
      const decision: Decision = {
        action: 'block',
        reason: 'known_bot_ua',
        confidence: 0.95,
      };
      this.report(req, decision);
      return decision;
    }

    // 3. Check IP against known bot ranges
    if (req.ip && this.rules.isBlockedIP(req.ip)) {
      const decision: Decision = {
        action: 'block',
        reason: 'known_bot_ip',
        confidence: 0.9,
      };
      this.report(req, decision);
      return decision;
    }

    // 4. Rate limiting
    if (req.ip && this.rateLimiter.isExceeded(req.ip)) {
      const decision: Decision = {
        action: 'block',
        reason: 'rate_limit',
        confidence: 0.7,
      };
      this.report(req, decision);
      return decision;
    }

    // 5. Header anomaly detection
    const anomalyScore = this.rules.headerAnomalyScore(req.headers);
    if (anomalyScore > this.rules.anomalyThreshold) {
      const decision: Decision = {
        action: 'block',
        reason: 'header_anomaly',
        confidence: anomalyScore,
      };
      this.report(req, decision);
      return decision;
    }

    // 6. Allow — still report for intelligence gathering
    const decision: Decision = { action: 'allow' };
    this.report(req, decision);
    return decision;
  }

  private report(req: NormalizedRequest, decision: Decision): void {
    const fp: Fingerprint = {
      ip: req.ip,
      userAgent: req.userAgent,
      headerOrder: req.headerNames,
      headers: req.headers,
      path: req.path,
      method: req.method,
      ts: Date.now(),
    };

    this.telemetry.push(fp);

    if (decision.action === 'block') {
      logger.debug(
        `bbloker: blocked ${req.ip} [${decision.reason}] UA="${req.userAgent.slice(0, 80)}"`
      );
    }
  }

  /** Clean up timers. Call when shutting down. */
  destroy(): void {
    this.rules.destroy();
    this.rateLimiter.destroy();
    this.telemetry.destroy();
    logger.info('bbloker: destroyed');
  }
}