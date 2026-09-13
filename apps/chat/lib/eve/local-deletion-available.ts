import { env } from "../env";

export function localDeletionAvailable() {
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
}
