import type { Fingerprint } from './types.js';
import { logger } from './logger';

export class Telemetry {
  private buffer: Fingerprint[] = [];
  private apiUrl: string;
  private apiKey: string;
  private maxBuffer: number;
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private enabled: boolean;

  constructor(config: {
    apiUrl: string;
    apiKey: string;
    flushInterval: number;
    bufferSize: number;
    enabled: boolean;
  }) {
    this.apiUrl = config.apiUrl;
    this.apiKey = config.apiKey;
    this.maxBuffer = config.bufferSize;
    this.enabled = config.enabled;

    if (!this.enabled) return;

    this.flushTimer = setInterval(() => this.flush(), config.flushInterval);
    if (this.flushTimer?.unref) {
      this.flushTimer.unref();
    }
  }

  push(fp: Fingerprint): void {
    if (!this.enabled) return;

    this.buffer.push(fp);

    // Force flush if buffer is full
    if (this.buffer.length >= this.maxBuffer) {
      this.flush();
    }
  }

  private async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const batch = this.buffer.splice(0);

    try {
      const res = await fetch(`${this.apiUrl}/v1/fingerprints`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ events: batch }),
        signal: AbortSignal.timeout(5_000),
      });

      if (!res.ok) {
        logger.warn(`bbloker: telemetry flush failed: ${res.status}`);
      } else {
        logger.debug(`bbloker: flushed ${batch.length} fingerprints`);
      }
    } catch {
      // Silent fail. Telemetry is best-effort.
      logger.debug(`bbloker: telemetry flush error (silent)`);
    }
  }

  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    this.buffer = [];
  }
}