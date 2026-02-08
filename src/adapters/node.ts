import { Bbloker } from "../core/engine";
import type { BblokerConfig, NormalizedRequest } from "../core/types";
import type { IncomingMessage, ServerResponse } from "node:http";

/**
 * Create a raw Node.js HTTP handler wrapper that blocks AI crawlers.
 *
 * Usage:
 * ```ts
 * import http from 'node:http';
 * import { createHandler } from '@bbloker/sdk/node';
 *
 * const bbloker = createHandler({
 *   apiKey: process.env.BBLOKER_API_KEY!,
 * });
 *
 * const server = http.createServer((req, res) => {
 *   if (bbloker(req, res)) return; // blocked
 *   res.end('Hello');
 * });
 * ```
 */
export function createHandler(config: BblokerConfig) {
  const bbloker = new Bbloker(config);

  /**
   * Returns true if the request was blocked (response already sent).
   * Returns false if allowed (caller should continue handling).
   */
  return function handler(req: IncomingMessage, res: ServerResponse): boolean {
    const normalized = normalizeNodeRequest(req);
    const decision = bbloker.analyze(normalized);

    if (decision.action === "block") {
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
          result.catch(() => {});
        }
      }
      res.writeHead(403);
      res.end();
      return true;
    }

    return false;
  };
}

function normalizeNodeRequest(req: IncomingMessage): NormalizedRequest {
  const rawHeaders = req.headers;
  const headers: Record<string, string> = {};
  const headerNames: string[] = [];

  for (const [key, value] of Object.entries(rawHeaders)) {
    const lower = key.toLowerCase();
    headers[lower] = Array.isArray(value) ? value.join(", ") : (value ?? "");
    headerNames.push(lower);
  }

  const forwarded = headers["x-forwarded-for"]?.split(",")[0]?.trim();
  const ip = stripIPv6Prefix(forwarded ?? headers["x-real-ip"] ?? req.socket?.remoteAddress ?? "0.0.0.0");

  return {
    ip,
    userAgent: headers["user-agent"] ?? "",
    headers,
    headerNames,
    path: req.url ?? "/",
    method: req.method ?? "GET",
  };
}

function stripIPv6Prefix(ip: string): string {
  return ip.startsWith("::ffff:") ? ip.slice(7) : ip;
}

export { Bbloker } from "../core/engine.js";
export type { BblokerConfig } from "../core/types.js";
