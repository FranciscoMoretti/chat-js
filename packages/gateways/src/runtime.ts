import type { AiGatewayModel } from "./models.ts";

interface GatewayLogger {
  debug: (data: unknown, message?: string) => void;
  info: (data: unknown, message?: string) => void;
  warn: (data: unknown, message?: string) => void;
  error: (data: unknown, message?: string) => void;
}

interface GatewayOptions {
  env?: Record<string, string | undefined>;
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- Keep the existing callback surface, which accepts ordinary callbacks without Bun's fetch.preconnect property. Shallow Readonly projections still trigger Oxlint; a deep readonly RequestInit cannot forward readonly header tuples to native fetch. */
  fetch?: (
    ...args: Parameters<typeof globalThis.fetch>
  ) => ReturnType<typeof globalThis.fetch>;
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
  getFallbackModels?: (gateway: string) => readonly AiGatewayModel[];
  logger?: GatewayLogger;
}

type GatewayReaderOptions = Readonly<Omit<GatewayOptions, "env" | "logger">> & {
  readonly env?: Readonly<NonNullable<GatewayOptions["env"]>>;
  readonly logger?: Readonly<GatewayLogger>;
};

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

class GatewayRuntime {
  protected readonly env: NonNullable<GatewayOptions["env"]>;
  protected readonly fetch: NonNullable<GatewayOptions["fetch"]>;
  protected readonly getFallbackModels: NonNullable<
    GatewayOptions["getFallbackModels"]
  >;
  protected readonly log: GatewayLogger;

  public constructor(options: GatewayReaderOptions = {}) {
    // oxlint-disable-next-line node/no-process-env -- Omitted env intentionally reads the live process environment; injected env objects and later environment updates retain their existing behavior.
    this.env = options.env ?? process.env;
    this.fetch =
      options.fetch ??
      /* oxlint-disable typescript/prefer-readonly-parameter-types, typescript/promise-function-async -- Forward the exact native argument objects and promise from dynamically selected global fetch; readonly parameter conversion or async adoption changes that boundary. */
      ((
        ...args: Parameters<typeof globalThis.fetch>
      ): ReturnType<typeof globalThis.fetch> => globalThis.fetch(...args));
    /* oxlint-enable typescript/prefer-readonly-parameter-types, typescript/promise-function-async */
    this.getFallbackModels = options.getFallbackModels ?? ((): never[] => []);
    this.log = options.logger ?? silentLogger;
  }
}

/* oxlint-disable import/no-named-export -- Keep the existing package entry bindings (GatewayRuntime); the enabled import/no-default-export convention rejects the default-export alternative. */
export { GatewayRuntime };
/* oxlint-enable import/no-named-export */

/* oxlint-disable import/no-named-export -- Keep the existing package entry bindings (GatewayOptions); the enabled import/no-default-export convention rejects the default-export alternative. */
export type { GatewayOptions };
/* oxlint-enable import/no-named-export */
