import { Bbloker } from "../core/engine";
import type { BblokerConfig, NormalizedRequest } from "../core/types";

type NextRequest = {
  ip?: string | null;
  headers: {
    get(name: string): string | null;
    forEach(cb: (value: string, key: string) => void): void;
  };
  nextUrl: { pathname: string };
  method: string;
  geo?: { country?: string };
};

type NextResponse = {
  next(): unknown;
};

/**
 * Create a Next.js middleware that blocks AI crawlers.
 *
 * Usage in middleware.ts:
 * ```ts
 * import { createMiddleware } from '@bbloker/sdk/nextjs';
 *
 * export default createMiddleware({
 *   apiKey: process.env.BBLOKER_API_KEY!,
 * });
 *
 * export const config = { matcher: '/((?!_next/static|favicon.ico).*)' };
 * ```
 */
export function createMiddleware(config: BblokerConfig) {
  const bbloker = new Bbloker(config);

  return async function middleware(request: NextRequest) {
    // Dynamically import NextResponse to avoid hard dependency
    const { NextResponse } = await import("next/server");

    const normalized = normalizeNextRequest(request);
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

      return new NextResponse(null, { status: 403 });
    }

    return NextResponse.next();
  };
}

function normalizeNextRequest(req: NextRequest): NormalizedRequest {
  const headers: Record<string, string> = {};
  const headerNames: string[] = [];

  req.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    headers[lower] = value;
    headerNames.push(lower);
  });

  return {
    ip:
      headers["x-forwarded-for"]?.split(",")[0]?.trim() ??
      headers["x-real-ip"] ??
      req.ip ??
      "0.0.0.0",
    userAgent: headers["user-agent"] ?? "",
    headers,
    headerNames,
    path: req.nextUrl.pathname,
    method: req.method,
  };
}

export { Bbloker } from "../core/engine.js";
export type { BblokerConfig } from "../core/types.js";
