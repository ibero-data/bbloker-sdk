import { describe, it, expect, afterEach } from "vitest";
import { Bbloker } from "../src/core/engine";
import type { NormalizedRequest } from "../src/core/types";

function makeRequest(
  overrides: Partial<NormalizedRequest> = {}
): NormalizedRequest {
  return {
    ip: "1.2.3.4",
    userAgent: "Mozilla/5.0 (compatible; normal browser)",
    headers: {
      "user-agent": "Mozilla/5.0 (compatible; normal browser)",
      accept: "text/html",
      "accept-language": "en-US",
      "accept-encoding": "gzip",
    },
    headerNames: ["user-agent", "accept", "accept-language", "accept-encoding"],
    path: "/",
    method: "GET",
    ...overrides,
  };
}

describe("Bbloker engine", () => {
  let bbloker: Bbloker;

  afterEach(() => {
    bbloker?.destroy();
  });

  it("allows normal browser requests", () => {
    bbloker = new Bbloker({ apiKey: "bb-sk-test" });
    const decision = bbloker.analyze(makeRequest());
    expect(decision.action).toBe("allow");
  });

  it("blocks GPTBot user agent", () => {
    bbloker = new Bbloker({ apiKey: "bb-sk-test" });
    const decision = bbloker.analyze(
      makeRequest({ userAgent: "Mozilla/5.0 GPTBot/1.0" })
    );
    expect(decision.action).toBe("block");
    expect(decision.reason).toBe("known_bot_ua");
    expect(decision.confidence).toBe(0.95);
  });

  it("blocks ClaudeBot user agent", () => {
    bbloker = new Bbloker({ apiKey: "bb-sk-test" });
    const decision = bbloker.analyze(
      makeRequest({ userAgent: "ClaudeBot/1.0" })
    );
    expect(decision.action).toBe("block");
    expect(decision.reason).toBe("known_bot_ua");
  });

  it("blocks user agents case-insensitively", () => {
    bbloker = new Bbloker({ apiKey: "bb-sk-test" });
    const decision = bbloker.analyze(makeRequest({ userAgent: "gptbot" }));
    expect(decision.action).toBe("block");
  });

  it("blocks IPs in known bot CIDR ranges", () => {
    bbloker = new Bbloker({ apiKey: "bb-sk-test" });
    // 20.15.240.1 is in 20.15.240.0/20
    const decision = bbloker.analyze(makeRequest({ ip: "20.15.240.1" }));
    expect(decision.action).toBe("block");
    expect(decision.reason).toBe("known_bot_ip");
    expect(decision.confidence).toBe(0.9);
  });

  it("allows IPs not in bot ranges", () => {
    bbloker = new Bbloker({ apiKey: "bb-sk-test" });
    const decision = bbloker.analyze(makeRequest({ ip: "192.168.1.1" }));
    expect(decision.action).toBe("allow");
  });

  it("blocks rate-limited IPs", () => {
    bbloker = new Bbloker({
      apiKey: "bb-sk-test",
      rateLimit: 2,
      rateLimitWindow: 60_000,
    });
    const req = makeRequest();
    bbloker.analyze(req); // 1
    bbloker.analyze(req); // 2
    const decision = bbloker.analyze(req); // 3 — exceeds limit
    expect(decision.action).toBe("block");
    expect(decision.reason).toBe("rate_limit");
    expect(decision.confidence).toBe(0.7);
  });

  it("throws when apiKey is missing", () => {
    expect(() => new Bbloker({ apiKey: "" })).toThrow("apiKey is required");
  });
});
