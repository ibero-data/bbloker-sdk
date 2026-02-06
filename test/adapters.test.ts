import { describe, it, expect, vi } from "vitest";

describe("Express adapter", () => {
  it("calls next() for normal requests", async () => {
    const { createMiddleware } = await import("../src/adapters/express");
    const mw = createMiddleware({ apiKey: "bb-sk-test" });
    const req = {
      headers: {
        "user-agent": "Mozilla/5.0 Chrome",
        "accept-language": "en-US",
        "accept-encoding": "gzip",
        accept: "text/html",
      },
      ip: "1.2.3.4",
      path: "/",
      method: "GET",
    };
    const res = { status: vi.fn().mockReturnThis(), end: vi.fn() };
    const next = vi.fn();

    mw(req, res as any, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("returns 403 for bot user agents", async () => {
    const { createMiddleware } = await import("../src/adapters/express");
    const mw = createMiddleware({ apiKey: "bb-sk-test" });
    const req = {
      headers: { "user-agent": "GPTBot/1.0" },
      ip: "1.2.3.4",
      path: "/",
      method: "GET",
    };
    const res = { status: vi.fn().mockReturnThis(), end: vi.fn() };
    const next = vi.fn();

    mw(req, res as any, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});

describe("Node adapter", () => {
  it("returns false for normal requests", async () => {
    const { createHandler } = await import("../src/adapters/node");
    const handler = createHandler({ apiKey: "bb-sk-test" });
    const req = {
      headers: {
        "user-agent": "Mozilla/5.0 Chrome",
        "accept-language": "en-US",
        "accept-encoding": "gzip",
        accept: "text/html",
      },
      url: "/",
      method: "GET",
      socket: { remoteAddress: "1.2.3.4" },
    };
    const res = { writeHead: vi.fn(), end: vi.fn() };
    const result = handler(req as any, res as any);
    expect(result).toBe(false);
  });

  it("returns true and sends 403 for bot requests", async () => {
    const { createHandler } = await import("../src/adapters/node");
    const handler = createHandler({ apiKey: "bb-sk-test" });
    const req = {
      headers: { "user-agent": "ClaudeBot/1.0" },
      url: "/",
      method: "GET",
      socket: { remoteAddress: "1.2.3.4" },
    };
    const res = { writeHead: vi.fn(), end: vi.fn() };
    const result = handler(req as any, res as any);
    expect(result).toBe(true);
    expect(res.writeHead).toHaveBeenCalledWith(403);
  });

  it("calls onBlock callback when blocking", async () => {
    const { createHandler } = await import("../src/adapters/node");
    const onBlock = vi.fn();
    const handler = createHandler({ apiKey: "bb-sk-test", onBlock });
    const req = {
      headers: { "user-agent": "GPTBot/1.0" },
      url: "/test",
      method: "GET",
      socket: { remoteAddress: "5.6.7.8" },
    };
    const res = { writeHead: vi.fn(), end: vi.fn() };
    handler(req as any, res as any);
    expect(onBlock).toHaveBeenCalledWith(
      expect.objectContaining({
        decision: expect.objectContaining({ action: "block" }),
      })
    );
  });
});

describe("Fastify adapter", () => {
  it("registers onRequest hook and allows normal requests", async () => {
    const { createPlugin } = await import("../src/adapters/fastify");
    const plugin = createPlugin({ apiKey: "bb-sk-test" });

    let hookHandler: any;
    const fastify = {
      addHook: vi.fn((_name: string, handler: any) => {
        hookHandler = handler;
      }),
    };
    const done = vi.fn();

    plugin(fastify as any, {}, done);
    expect(fastify.addHook).toHaveBeenCalledWith("onRequest", expect.any(Function));
    expect(done).toHaveBeenCalled();

    // Simulate a normal request through the hook
    const request = {
      ip: "1.2.3.4",
      headers: {
        "user-agent": "Mozilla/5.0 Chrome",
        "accept-language": "en-US",
        "accept-encoding": "gzip",
        accept: "text/html",
      },
      url: "/",
      method: "GET",
    };
    const reply = { status: vi.fn().mockReturnThis(), send: vi.fn() };
    const hookDone = vi.fn();

    hookHandler(request, reply, hookDone);
    expect(hookDone).toHaveBeenCalled();
    expect(reply.status).not.toHaveBeenCalled();
  });

  it("blocks bot requests with 403", async () => {
    const { createPlugin } = await import("../src/adapters/fastify");
    const plugin = createPlugin({ apiKey: "bb-sk-test" });

    let hookHandler: any;
    const fastify = {
      addHook: vi.fn((_name: string, handler: any) => {
        hookHandler = handler;
      }),
    };
    plugin(fastify as any, {}, vi.fn());

    const request = {
      ip: "1.2.3.4",
      headers: { "user-agent": "Bytespider" },
      url: "/",
      method: "GET",
    };
    const reply = { status: vi.fn().mockReturnThis(), send: vi.fn() };
    const hookDone = vi.fn();

    hookHandler(request, reply, hookDone);
    expect(reply.status).toHaveBeenCalledWith(403);
    expect(hookDone).not.toHaveBeenCalled();
  });
});
