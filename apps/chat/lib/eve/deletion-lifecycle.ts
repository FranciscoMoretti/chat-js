import { env } from "@/lib/env";

import { createEveLifecycleProvider } from "./lifecycle/provider";
import type { SupportedLifecycleProvider } from "./lifecycle/provider";
import { resolveWorkflowWorld } from "./world-config";

// Native compatibility is required before revoking access or erasing resources.
// This does not establish sandbox coverage; the local coordinator still owns it.
export const requireEveDeletionLifecycle =
  async (): Promise<SupportedLifecycleProvider> => {
    const lifecycle = createEveLifecycleProvider({
      databaseUrl: env.WORKFLOW_POSTGRES_URL,
      world: resolveWorkflowWorld(env),
    });
    if (!lifecycle.supported) {
      throw new Error(lifecycle.reason);
    }
    await lifecycle.check();
    return lifecycle;
  };
