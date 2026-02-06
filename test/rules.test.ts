import { describe, it, expect, afterEach } from "vitest";
import { RuleManager } from "../src/core/rules";

describe("RuleManager", () => {
  let rules: RuleManager;

  afterEach(() => {
    rules?.destroy();
  });

  describe("UA matching", () => {
    it("detects known bot user agents", () => {
      rules = new RuleManager({
        apiUrl: "http://localhost",
        apiKey: "test",
        syncInterval: 999_999,
      });
      expect(rules.isBlockedUA("GPTBot/1.0")).toBe(true);
      expect(rules.isBlockedUA("ClaudeBot")).toBe(true);
      expect(rules.isBlockedUA("Bytespider")).toBe(true);
      expect(rules.isBlockedUA("Meta-ExternalAgent/1.0")).toBe(true);
    });

    it("allows normal browser user agents", () => {
      rules = new RuleManager({
        apiUrl: "http://localhost",
        apiKey: "test",
        syncInterval: 999_999,
      });
      expect(rules.isBlockedUA("Mozilla/5.0 Chrome/120")).toBe(false);
      expect(rules.isBlockedUA("Mozilla/5.0 Safari/605")).toBe(false);
    });

    it("matches case-insensitively", () => {
      rules = new RuleManager({
        apiUrl: "http://localhost",
        apiKey: "test",
        syncInterval: 999_999,
      });
      expect(rules.isBlockedUA("GPTBOT")).toBe(true);
      expect(rules.isBlockedUA("claudebot")).toBe(true);
    });
  });

  describe("CIDR matching", () => {
    it("blocks IPs in known bot ranges", () => {
      rules = new RuleManager({
        apiUrl: "http://localhost",
        apiKey: "test",
        syncInterval: 999_999,
      });
      // 20.15.240.0/20 covers 20.15.240.0 - 20.15.255.255
      expect(rules.isBlockedIP("20.15.240.5")).toBe(true);
      expect(rules.isBlockedIP("20.15.255.254")).toBe(true);
    });

    it("allows IPs not in bot ranges", () => {
      rules = new RuleManager({
        apiUrl: "http://localhost",
        apiKey: "test",
        syncInterval: 999_999,
      });
      expect(rules.isBlockedIP("192.168.1.1")).toBe(false);
      expect(rules.isBlockedIP("8.8.8.8")).toBe(false);
    });

    it("skips IPv6 addresses", () => {
      rules = new RuleManager({
        apiUrl: "http://localhost",
        apiKey: "test",
        syncInterval: 999_999,
      });
      expect(rules.isBlockedIP("::1")).toBe(false);
    });
  });

  describe("header anomaly scoring", () => {
    it("returns high score for bot-like headers", () => {
      rules = new RuleManager({
        apiUrl: "http://localhost",
        apiKey: "test",
        syncInterval: 999_999,
      });
      // All three anomaly patterns match: accept=*/*, empty accept-language, empty accept-encoding
      const score = rules.headerAnomalyScore({
        accept: "*/*",
        "accept-language": "",
        "accept-encoding": "",
      });
      expect(score).toBeGreaterThan(0.7);
    });

    it("returns low score for normal browser headers", () => {
      rules = new RuleManager({
        apiUrl: "http://localhost",
        apiKey: "test",
        syncInterval: 999_999,
      });
      const score = rules.headerAnomalyScore({
        accept: "text/html,application/xhtml+xml",
        "accept-language": "en-US,en;q=0.9",
        "accept-encoding": "gzip, deflate, br",
      });
      expect(score).toBeLessThan(0.5);
    });

    it("scores empty headers as anomalous (missing headers match bot patterns)", () => {
      rules = new RuleManager({
        apiUrl: "http://localhost",
        apiKey: "test",
        syncInterval: 999_999,
      });
      // Empty headers means accept-language="" and accept-encoding="" match ^$ patterns
      const score = rules.headerAnomalyScore({});
      expect(score).toBeGreaterThan(0.7);
    });
  });
});
