type LogLevel = "log" | "warn" | "error";

interface DebugOptions {
  enabled?: boolean;
  level?: LogLevel;
  prefix?: string;
}

class DebugLogger {
  private enabled: boolean;
  private prefix: string;
  private level: LogLevel;

  constructor(options: DebugOptions = {}) {
    this.enabled = options.enabled ?? process.env.DEBUG === "true";
    this.prefix = options.prefix ?? "[Store]";
    this.level = options.level ?? "warn";
  }

  private shouldLog(level: LogLevel): boolean {
    if (!this.enabled) {
      return false;
    }

    const levels = ["log", "warn", "error"];
    return levels.indexOf(level) >= levels.indexOf(this.level);
  }

  log(...args: unknown[]): void {
    if (this.shouldLog("log")) {
      console.log(this.prefix, ...args);
    }
  }

  warn(...args: unknown[]): void {
    if (this.shouldLog("warn")) {
      console.warn(this.prefix, ...args);
    }
  }

  error(...args: unknown[]): void {
    if (this.shouldLog("error")) {
      console.error(this.prefix, ...args);
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  setPrefix(prefix: string): void {
    this.prefix = prefix;
  }
}

// Create default logger instance
export const debug = new DebugLogger();

// Export for external configuration
export const configureDebug = (options: DebugOptions): void => {
  if (options.enabled !== undefined) {
    debug.setEnabled(options.enabled);
  }
  if (options.level !== undefined) {
    debug.setLevel(options.level);
  }
  if (options.prefix !== undefined) {
    debug.setPrefix(options.prefix);
  }
};

// Export the class for custom loggers
export { DebugLogger };
