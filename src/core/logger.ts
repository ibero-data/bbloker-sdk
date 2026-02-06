type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

const LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
};

class Logger {
  private level: number = LEVELS.warn;

  setLevel(level: LogLevel): void {
    this.level = LEVELS[level];
  }

  debug(...args: unknown[]): void {
    if (this.level <= LEVELS.debug) console.debug('[bbloker]', ...args);
  }

  info(...args: unknown[]): void {
    if (this.level <= LEVELS.info) console.info('[bbloker]', ...args);
  }

  warn(...args: unknown[]): void {
    if (this.level <= LEVELS.warn) console.warn('[bbloker]', ...args);
  }

  error(...args: unknown[]): void {
    if (this.level <= LEVELS.error) console.error('[bbloker]', ...args);
  }
}

export const logger = new Logger();