import type { AiGatewayModel } from "./models.ts";

interface GatewayLogger {
  debug: (data: unknown, message?: string) => void;
  info: (data: unknown, message?: string) => void;
  warn: (data: unknown, message?: string) => void;
  error: (data: unknown, message?: string) => void;
}

interface GatewayOptions {
  env?: Record<string, string | undefined>;
  fetch?: (
    ...args: Parameters<typeof globalThis.fetch>
  ) => ReturnType<typeof globalThis.fetch>;
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
    this.env = options.env ?? process.env;
    this.fetch =
      options.fetch ??
      (async (
        ...args: Parameters<typeof globalThis.fetch>
      ): ReturnType<typeof globalThis.fetch> =>
        await globalThis.fetch(...args));
    this.getFallbackModels = options.getFallbackModels ?? ((): never[] => []);
    this.log = options.logger ?? silentLogger;
  }
}

export { GatewayRuntime };

export type { GatewayOptions };
