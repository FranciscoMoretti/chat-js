import type { AiGatewayModel } from "./models.ts";

interface GatewayLogger {
  debug: (data: unknown, message?: string) => void;
  info: (data: unknown, message?: string) => void;
  warn: (data: unknown, message?: string) => void;
  error: (data: unknown, message?: string) => void;
}

/* oxlint-disable typescript/prefer-readonly-parameter-types -- GatewayOptions fetch preserves native Parameters<typeof fetch>/ReturnType<typeof fetch> and platform Request/RequestInit/AbortSignal interfaces; env/logger objects remain caller supplied. */
interface GatewayOptions {
  env?: Record<string, string | undefined>;
  fetch?: (
    ...args: Parameters<typeof globalThis.fetch>
  ) => ReturnType<typeof globalThis.fetch>;
  getFallbackModels?: (gateway: string) => readonly AiGatewayModel[];
  logger?: GatewayLogger;
}
/* oxlint-enable typescript/prefer-readonly-parameter-types */

const silentLogger: GatewayLogger = {
  debug: (): void => {
    /* Intentionally silent when no logger is provided. */
  },
  error: (): void => {
    /* Intentionally silent when no logger is provided. */
  },
  info: (): void => {
    /* Intentionally silent when no logger is provided. */
  },
  warn: (): void => {
    /* Intentionally silent when no logger is provided. */
  },
};

/* oxlint-disable node/no-process-env -- Read configuration at this server or installer boundary so callers retain the documented environment-variable behavior. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- GatewayOptions fetch preserves native Parameters<typeof fetch>/ReturnType<typeof fetch> and platform Request/RequestInit/AbortSignal interfaces; env/logger objects remain caller supplied. */
/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
class GatewayRuntime {
  protected readonly env;
  protected readonly fetch;
  protected readonly getFallbackModels;
  protected readonly log;

  public constructor(options: GatewayOptions = {}) {
    this.env = options.env ?? process.env;
    this.fetch =
      options.fetch ??
      ((
        ...args: Parameters<typeof globalThis.fetch>
      ): ReturnType<typeof globalThis.fetch> => globalThis.fetch(...args));
    this.getFallbackModels = options.getFallbackModels ?? ((): never[] => []);
    this.log = options.logger ?? silentLogger;
  }
}
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable node/no-process-env */

export { GatewayRuntime };

export type { GatewayOptions };
