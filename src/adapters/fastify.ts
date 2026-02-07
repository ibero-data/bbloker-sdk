import { Bbloker } from "../core/engine";
import type { BblokerConfig, NormalizedRequest } from "../core/types";

type FastifyRequest = {
  ip: string;
  headers: Record<string, string | string[] | undefined>;
  url: string;
  method: string;
};

type FastifyReply = {
  status(code: number): FastifyReply;
  send(body?: string): FastifyReply;
};

type FastifyInstance = {
  addHook(
    name: "onRequest",
    handler: (
      request: FastifyRequest,
      reply: FastifyReply,
      done: (err?: Error) => void
    ) => void
  ): void;
};

/**
 * Create a Fastify plugin that blocks AI crawlers.
 *
 * Usage:
 * ```ts
 * import Fastify from 'fastify';
 * import { createPlugin } from '@bbloker/sdk/fastify';
 *
 * const app = Fastify();
 * app.register(createPlugin({
 *   apiKey: process.env.BBLOKER_API_KEY!,
 * }));
 * ```
 */
export function createPlugin(config: BblokerConfig) {
  const bbloker = new Bbloker(config);

  return function bblokerPlugin(
    fastify: FastifyInstance,
    _opts: Record<string, unknown>,
    done: (err?: Error) => void
  ): void {
    fastify.addHook("onRequest", (request, reply, hookDone) => {
      const normalized = normalizeFastifyRequest(request);
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
            result.then(() => {
              reply.status(403).send();
            });
            return;
          }
        }

        reply.status(403).send();
        return;
      }

      hookDone();
    });

    done();
  };
}

function normalizeFastifyRequest(req: FastifyRequest): NormalizedRequest {
  const rawHeaders = req.headers;
  const headers: Record<string, string> = {};
  const headerNames: string[] = [];

  for (const [key, value] of Object.entries(rawHeaders)) {
    const lower = key.toLowerCase();
    headers[lower] = Array.isArray(value) ? value.join(", ") : (value ?? "");
    headerNames.push(lower);
  }

  const forwarded = headers["x-forwarded-for"]?.split(",")[0]?.trim();
  const ip = forwarded ?? req.ip ?? "0.0.0.0";

  return {
    ip,
    userAgent: headers["user-agent"] ?? "",
    headers,
    headerNames,
    path: req.url ?? "/",
    method: req.method ?? "GET",
  };
}

export { Bbloker } from "../core/engine.js";
export type { BblokerConfig } from "../core/types.js";
