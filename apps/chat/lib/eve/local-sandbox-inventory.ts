import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";

const ownerSchema = z.strictObject({
  version: z.literal(1),
  backendName: z.literal("microsandbox"),
  sessionKey: z.string().min(1),
  sessionId: z.string().min(1),
});

/**
 * Internal local inventory. The caller authorizes and retires the native family
 * before using its session IDs. Unattributed directories prevent proof of full
 * coverage; never infer their ownership or delete them by name matching.
 */
export async function readLocalEveSandboxInventory(
  appRoot: string,
  sessionIds: string[]
) {
  const directory = join(
    appRoot,
    ".eve",
    "sandbox-cache",
    "microsandbox",
    "sessions"
  );
  const entries = await readdir(directory, { withFileTypes: true }).catch(
    (error: unknown) => {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        return [];
      }
      throw error;
    }
  );
  const family = new Set(sessionIds);
  const owned: Array<{ sessionDirectory: string; sessionKey: string }> = [];
  const unattributedDirectories: string[] = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const sessionDirectory = join(directory, entry.name);
    // Do not traverse symlinks or unexpected files in the provider cache.
    if (!entry.isDirectory()) {
      unattributedDirectories.push(sessionDirectory);
      continue;
    }
    const raw = await readFile(
      join(sessionDirectory, "owner.json"),
      "utf8"
    ).catch((error: unknown) => {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        return undefined;
      }
      throw error;
    });
    let parsed: unknown;
    try {
      parsed = raw === undefined ? undefined : JSON.parse(raw);
    } catch {
      parsed = undefined;
    }
    const owner = ownerSchema.safeParse(parsed);
    if (!owner.success || owner.data.sessionKey !== entry.name) {
      unattributedDirectories.push(sessionDirectory);
      continue;
    }
    if (family.has(owner.data.sessionId)) {
      owned.push({ sessionDirectory, sessionKey: owner.data.sessionKey });
    }
  }
  return { owned, unattributedDirectories };
}
