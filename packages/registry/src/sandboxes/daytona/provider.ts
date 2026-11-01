import type { DaytonaProvider } from "./adapter";
import type { SandboxProvider } from "@chat-js/sandboxes/provider";
import { readSandboxEnvironment } from "./daytona-sandbox-env";
import { commandSandbox, createDaytonaProvider } from "./adapter";

// Reuse the SDK event connection within each worker process.
let client: DaytonaProvider | undefined;

export const createSandboxProvider = (): SandboxProvider => {
  const env = readSandboxEnvironment();
  client ??= createDaytonaProvider({
    apiKey: env.DAYTONA_API_KEY ?? "",
    organizationId: env.DAYTONA_ORGANIZATION_ID ?? "",
  });
  const provider = client;
  return {
    scope: provider.cleanup.scope,
    async create({ name, runtime, signal }) {
      const resource = await provider.create(name, runtime);
      return { name: resource.name, ...commandSandbox(resource, signal) };
    },
    deleteAndConfirmAbsent: provider.cleanup.deleteAndConfirmAbsent,
  };
};

/** Available without resolving provider credentials. */
export const supportsPersistentSandbox = false;
