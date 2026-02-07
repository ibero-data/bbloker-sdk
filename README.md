# bbloker

AI bot blocker SDK. Drop-in middleware that detects and blocks AI crawlers (GPTBot, ClaudeBot, Meta, Bytespider, etc.) from your web application.

Works with any framework. No infrastructure changes needed.

## Install

```bash
npm install @bbloker/sdk
```

## Quick Start

### Next.js

```ts
// middleware.ts
import { createMiddleware } from "@bbloker/sdk/nextjs";

export default createMiddleware({
  apiKey: process.env.BBLOKER_API_KEY!,
});

export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.ico).*)",
};
```

### Express

```ts
import express from "express";
import { createMiddleware } from "@bbloker/sdk/express";

const app = express();

app.use(
  createMiddleware({
    apiKey: process.env.BBLOKER_API_KEY!,
  }),
);
```

### Hono (Cloudflare Workers / Deno / Bun)

```ts
import { Hono } from "hono";
import { createMiddleware } from "@bbloker/sdk/hono";

const app = new Hono();

app.use(
  "*",
  createMiddleware({
    apiKey: process.env.BBLOKER_API_KEY!,
  }),
);
```

### Raw Node.js

```ts
import http from "node:http";
import { createHandler } from "@bbloker/sdk/node";

const guard = createHandler({
  apiKey: process.env.BBLOKER_API_KEY!,
});

const server = http.createServer((req, res) => {
  if (guard(req, res)) return; // blocked, response already sent
  res.end("Hello");
});
```

## How It Works

1. SDK intercepts every incoming request **before** your route handlers
2. Extracts a fingerprint (UA, IP, headers, request pattern)
3. Matches against local rule cache (ships with 40+ known bot signatures)
4. Blocks or allows in **< 1ms** — no external API call in the hot path
5. Async: sends anonymized fingerprints to bbloker cloud for shared intelligence
6. Rules auto-update every 5 minutes from the bbloker API

## What It Blocks

- OpenAI (GPTBot, ChatGPT-User, OAI-SearchBot)
- Anthropic (ClaudeBot, anthropic-ai)
- Meta (Meta-ExternalAgent, FacebookBot, facebookexternalhit)
- Bytedance (Bytespider)
- Google AI training (Google-Extended)
- Apple AI training (Applebot-Extended)
- Perplexity, Cohere, Diffbot, Amazon, and 30+ more
- Known bot IP ranges
- Anomalous header patterns (missing Accept-Language, wrong header order)
- Rate limit violations

## Configuration

```ts
import { Bbloker } from "@bbloker/sdk";

const bbloker = new Bbloker({
  // Required
  apiKey: "bb-sk-...",

  // Optional
  apiUrl: "https://bbloker.com", // self-hosted API
  syncInterval: 300_000, // rule sync interval (5 min)
  flushInterval: 10_000, // telemetry flush interval (10s)
  bufferSize: 100, // max fingerprints before force flush
  telemetry: true, // send fingerprints to cloud
  rateLimit: 60, // max requests per IP per window
  rateLimitWindow: 60_000, // rate limit window (1 min)
  logLevel: "warn", // debug | info | warn | error | silent

  // Custom block handler
  onBlock: ({ fingerprint, decision }) => {
    console.log(`Blocked: ${fingerprint.ip} - ${decision.reason}`);
  },
});
```

## Offline Mode

The SDK ships with a bundled rule set and works immediately without an API connection. The API key enables cloud features: real-time rule updates, shared threat intelligence, and the analytics dashboard.

## License

APACHE-2.0 License. See [LICENSE](LICENSE) for details.