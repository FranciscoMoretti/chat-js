import { env } from "@/lib/env";

import { resolveWorkflowWorld } from "./world-config";

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (localDeletionAvailable); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export const localDeletionAvailable = (): boolean => {
  if (resolveWorkflowWorld(env) === "vercel") {
    return false;
  }
  try {
    const local = new Set(["localhost", "127.0.0.1", "[::1]"]);
    const world = new URL(env.WORKFLOW_POSTGRES_URL ?? "");
    const worker = new URL(env.EVE_INTERNAL_ORIGIN ?? "");
    return (
      ["postgres:", "postgresql:"].includes(world.protocol) &&
      local.has(world.hostname) &&
      ["http:", "https:"].includes(worker.protocol) &&
      local.has(worker.hostname)
    );
  } catch {
    return false;
  }
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
