import { env } from "@/lib/env";
import { resolveWorkflowWorld } from "@/lib/eve/world-config";
import { requireEveDeletionLifecycle } from "@/lib/eve/deletion-lifecycle";

/** Managed Vercel retains workflow payloads under provider policy; only PostgreSQL promises purge. */
export const getGuestPurgeLifecycle = (): ReturnType<
  typeof requireEveDeletionLifecycle
> | null =>
  resolveWorkflowWorld(env) === "vercel" ? null : requireEveDeletionLifecycle();
