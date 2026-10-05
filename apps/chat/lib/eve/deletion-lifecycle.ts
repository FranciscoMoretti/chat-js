import { env } from "@/lib/env";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { SupportedLifecycleProvider } from "./lifecycle/provider";
/* oxlint-enable sort-imports */
import { createEveLifecycleProvider } from "./lifecycle/provider";
import { resolveWorkflowWorld } from "./world-config";

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (requireEveDeletionLifecycle); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
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
/* oxlint-enable import/prefer-default-export, import/no-named-export */
