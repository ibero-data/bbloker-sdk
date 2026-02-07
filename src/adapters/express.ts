import { Bbloker } from '../core/engine';
import type { BblokerConfig, NormalizedRequest } from '../core/types.js';

type Req = {
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
  path?: string;
  url?: string;
  method?: string;
  socket?: { remoteAddress?: string };
};

type Res = {
  status(code: number): Res;
  end(body?: string): void;
  json(data: unknown): void;
};

type Next = (err?: unknown) => void;

/**
 * Create Express/Connect middleware that blocks AI crawlers.
 *
 * Usage:
 * ```ts
 * import { createMiddleware } from '@bbloker/sdk/express';
 *
 * app.use(createMiddleware({
 *   apiKey: process.env.BBLOKER_API_KEY!,
 * }));
 * ```
 */
export function createMiddleware(config: BblokerConfig) {
  const bbloker = new Bbloker(config);

  return function middleware(req: Req, res: Res, next: Next): void {
    const normalized = normalizeExpressRequest(req);
    const decision = bbloker.analyze(normalized);

    if (decision.action === 'block') {
      if (config.onBlock) {
        const result = config.onBlock({
          fingerprint: {
            ip: normalized.ip,
            userAgent: normalized.userAgent,
            headerOrder: normalized.headerNames,
            headers: normalized.headers,
            path: normalized.path,
            method: normalized.method,
            ts: Date.now(),
          },
          decision,
        });

        if (result instanceof Promise) {
          result.then((r) => {
            if (!r) res.status(403).end();
          });
          return;
        }
      }

      res.status(403).end();
      return;
    }

    next();
  };
}

function normalizeExpressRequest(req: Req): NormalizedRequest {
  const rawHeaders = req.headers;
  const headers: Record<string, string> = {};
  const headerNames: string[] = [];

  for (const [key, value] of Object.entries(rawHeaders)) {
    const lower = key.toLowerCase();
    headers[lower] = Array.isArray(value) ? value.join(', ') : (value ?? '');
    headerNames.push(lower);
  }

  const forwarded = headers['x-forwarded-for']?.split(',')[0]?.trim();
  const ip = forwarded ?? req.ip ?? req.socket?.remoteAddress ?? '0.0.0.0';

  return {
    ip,
    userAgent: headers['user-agent'] ?? '',
    headers,
    headerNames,
    path: req.path ?? req.url ?? '/',
    method: req.method ?? 'GET',
  };
}

export { Bbloker } from '../core/engine.js';
export type { BblokerConfig } from '../core/types.js';