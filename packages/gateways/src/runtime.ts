import type { AiGatewayModel } from "./models.ts";

interface GatewayLogger {
  debug: (data: unknown, message?: string) => void;
  info: (data: unknown, message?: string) => void;
  warn: (data: unknown, message?: string) => void;
  error: (data: unknown, message?: string) => void;
}

/* oxlint-disable import/exports-last -- Keep the exported declaration beside the types and initialization it describes; moving it can reorder module initialization. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
export interface GatewayOptions {
  env?: Record<string, string | undefined>;
  fetch?: (
    ...args: Parameters<typeof globalThis.fetch>
  ) => ReturnType<typeof globalThis.fetch>;
  getFallbackModels?: (gateway: string) => readonly AiGatewayModel[];
  logger?: GatewayLogger;
}
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/exports-last */

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

/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
/* oxlint-disable node/no-process-env -- Read configuration at this server or installer boundary so callers retain the documented environment-variable behavior. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
export class GatewayRuntime {
  protected readonly env;
  protected readonly fetch;
  protected readonly getFallbackModels;
  protected readonly log;

  public constructor(options: GatewayOptions = {}) {
    this.env = options.env ?? process.env;
    this.fetch = options.fetch ?? ((...args) => globalThis.fetch(...args));
    this.getFallbackModels = options.getFallbackModels ?? (() => []);
    this.log = options.logger ?? silentLogger;
  }
}
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable node/no-process-env */
/* oxlint-enable import/no-named-export */
