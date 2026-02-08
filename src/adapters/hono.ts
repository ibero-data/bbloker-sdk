import { Bbloker } from "../core/engine";
import type { BblokerConfig, NormalizedRequest } from "../core/types";

type HonoContext = {
  req: {
    raw: Request;
    header(name: string): string | undefined;
    path: string;
    method: string;
  };
  header(name: string): string | undefined;
  text(body: string, status?: number): Response;
};

type HonoNext = () => Promise<void>;

/**
 * Create Hono middleware that blocks AI crawlers.
 * Works on Cloudflare Workers, Deno, Bun, Node.
 *
 * Usage:
 * ```ts
 * import { Hono } from 'hono';
 * import { createMiddleware } from '@bbloker/sdk/hono';
 *
 * const app = new Hono();
 * app.use('*', createMiddleware({
 *   apiKey: process.env.BBLOKER_API_KEY!,
 * }));
 * ```
 */
export function createMiddleware(config: BblokerConfig) {
  const bbloker = new Bbloker(config);

  return async function middleware(c: HonoContext, next: HonoNext) {
    const normalized = normalizeHonoRequest(c);
    const decision = bbloker.analyze(normalized);

    if (decision.action === "block") {
      if (config.onBlock) {
        const result = await config.onBlock({
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
        if (result instanceof Response) return result;
      }

      return c.text("Forbidden", 403);
    }

    await next();
  };
}

function normalizeHonoRequest(c: HonoContext): NormalizedRequest {
  const headers: Record<string, string> = {};
  const headerNames: string[] = [];

  c.req.raw.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    headers[lower] = value;
    headerNames.push(lower);
  });

  const forwarded = headers["x-forwarded-for"]?.split(",")[0]?.trim();
  const cfIp = headers["cf-connecting-ip"];
  const ip = stripIPv6Prefix(cfIp ?? forwarded ?? headers["x-real-ip"] ?? "0.0.0.0");

  return {
    ip,
    userAgent: headers["user-agent"] ?? "",
    headers,
    headerNames,
    path: c.req.path,
    method: c.req.method,
  };
}

function stripIPv6Prefix(ip: string): string {
  return ip.startsWith("::ffff:") ? ip.slice(7) : ip;
}

export { Bbloker } from "../core/engine.js";
export type { BblokerConfig } from "../core/types.js";
