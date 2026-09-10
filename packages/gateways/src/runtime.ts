import type { AiGatewayModel } from "./models.ts";

interface GatewayLogger {
  debug(data: unknown, message?: string): void;
  info(data: unknown, message?: string): void;
  warn(data: unknown, message?: string): void;
  error(data: unknown, message?: string): void;
}

export interface GatewayOptions {
  env?: Record<string, string | undefined>;
  fetch?: (
    ...args: Parameters<typeof globalThis.fetch>
  ) => ReturnType<typeof globalThis.fetch>;
  getFallbackModels?: (gateway: string) => readonly AiGatewayModel[];
  logger?: GatewayLogger;
}

const silentLogger: GatewayLogger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
};

export class GatewayRuntime {
  protected readonly env;
  protected readonly fetch;
  protected readonly getFallbackModels;
  protected readonly log;

  constructor(options: GatewayOptions = {}) {
    this.env = options.env ?? process.env;
    this.fetch = options.fetch ?? ((...args) => globalThis.fetch(...args));
    this.getFallbackModels = options.getFallbackModels ?? (() => []);
    this.log = options.logger ?? silentLogger;
  }
}
