import { env } from "@/lib/env";

import { createEveLifecycleProvider } from "./lifecycle/provider";
import type { SupportedLifecycleProvider } from "./lifecycle/provider";
import { resolveWorkflowWorld } from "./world-config";

// Selection alone performs no database work. Family retirement checks compatibility
// before revoking access; each provider operation also checks its own entrypoint.
// This does not establish sandbox coverage; the local coordinator still owns it.
export const requireEveDeletionLifecycle = (): SupportedLifecycleProvider => {
  const lifecycle = createEveLifecycleProvider({
    databaseUrl: env.WORKFLOW_POSTGRES_URL,
    world: resolveWorkflowWorld(env),
  });
  if (!lifecycle.supported) {
    throw new Error(lifecycle.reason);
  }
  return lifecycle;
};
