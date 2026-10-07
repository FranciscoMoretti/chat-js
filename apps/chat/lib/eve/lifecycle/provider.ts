import { createPostgresLifecycle } from "./postgres/provider";

interface LifecycleResources {
  runIds: string[];
  streamIds: string[];
}

interface LifecycleInventory extends LifecycleResources {
  activeRunIds: string[];
  ambiguousStreamIds: string[];
  missingRunIds: string[];
}

interface SupportedLifecycleProvider {
  readonly supported: true;
  readonly world: "@workflow/world-postgres";
  readonly contractVersion: "1";
  readonly capabilities: {
    readonly durableRetirement: true;
    readonly lateWriteFence: true;
    readonly queuePurge: true;
    readonly payloadPurge: true;
    readonly sandboxLifecycle: false;
  };
  check: () => Promise<void>;
  inventory: (sessionId: string) => Promise<LifecycleInventory>;
  retire: (
    sessionIds: readonly string[],
    retireAndSettle: (sessionId: string) => Promise<void>
  ) => Promise<void>;
  prepare: (
    sessionId: string,
    retireAndSettle: () => Promise<void>
  ) => Promise<LifecycleResources>;
  purge: (
    sessionId: string,
    retireAndSettle: () => Promise<void>
  ) => Promise<LifecycleResources>;
}

interface UnsupportedLifecycleProvider {
  readonly supported: false;
  readonly world: string;
  readonly reason: string;
}

type LifecycleProvider =
  | SupportedLifecycleProvider
  | UnsupportedLifecycleProvider;

// The caller authorizes a deleting session and supplies idempotent retirement +
// usage settlement. prepare retains native payloads for external-resource checks;
// purge is allowed only after those resources have been accounted for. Neither
// operation authorizes ownership or marks the application's deletion complete.
const createEveLifecycleProvider = (options: {
  readonly world: string;
  readonly databaseUrl?: string;
}): LifecycleProvider => {
  if (options.world !== "@workflow/world-postgres") {
    return {
      reason:
        "This workflow provider has no verified durable retirement, late-write fence, queue purge and payload-erasure contract.",
      supported: false,
      world: options.world,
    };
  }
  const databaseUrl = options.databaseUrl ?? "";
  if (databaseUrl === "") {
    return {
      reason: "The PostgreSQL workflow lifecycle requires its database URL.",
      supported: false,
      world: options.world,
    };
  }
  const target = URL.parse(databaseUrl);
  if (
    target === null ||
    !["postgres:", "postgresql:"].includes(target.protocol) ||
    !["localhost", "127.0.0.1", "[::1]"].includes(target.hostname)
  ) {
    return {
      reason:
        "Native lifecycle setup and acceptance currently support only loopback PostgreSQL databases.",
      supported: false,
      world: options.world,
    };
  }
  return createPostgresLifecycle(databaseUrl);
};

/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (createEveLifecycleProvider); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export { createEveLifecycleProvider };
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Keep the named type bindings (LifecycleResources, LifecycleInventory, SupportedLifecycleProvider, UnsupportedLifecycleProvider, LifecycleProvider); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export type {
  LifecycleResources,
  LifecycleInventory,
  SupportedLifecycleProvider,
  UnsupportedLifecycleProvider,
  LifecycleProvider,
};
/* oxlint-enable import/no-named-export */
