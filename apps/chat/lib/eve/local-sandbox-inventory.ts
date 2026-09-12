import { createHash } from "node:crypto";
import { readdir, readFile, realpath } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";

// Pinned EVE 0.52.2 keys retain the complete native ULID before the node suffix.
// Use this only to exclude unrelated old directories, never to authorize erasure.
const legacyKeyPattern =
  /^eve-sbx-ses-microsandbox-([a-f0-9]{16})-[a-f0-9]{12}-(wrun_[0-7][0-9A-HJKMNP-TV-Z]{25})-[a-zA-Z0-9._-]+$/;

export const localEveSandboxOwnerSchema = z.strictObject({
  version: z.literal(1),
  writeAheadResources: z.literal(true).optional(),
  backendName: z.literal("microsandbox"),
  sessionKey: z.string().min(1),
  sessionId: z.string().min(1),
});

/**
 * Internal local inventory. The caller authorizes and retires the native family
 * before using its session IDs. Unattributed directories prevent proof of full
 * coverage. Canonical keys may exclude unrelated older sessions, but never authorize erasure.
 */
export async function readLocalEveSandboxInventory(
  appRoot: string,
  sessionIds: string[]
) {
  const cacheRoot = join(appRoot, ".eve", "sandbox-cache");
  const backends = await readdir(cacheRoot, { withFileTypes: true }).catch(
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
  // Default EVE backend selection can change between launches. A local inventory
  // must not silently ignore evidence from a different provider or follow links.
  const unsupported = backends.filter(
    (entry) => entry.name !== "microsandbox" || !entry.isDirectory()
  );
  if (unsupported.length) {
    return {
      owned: [],
      unattributedDirectories: unsupported
        .map((entry) => join(cacheRoot, entry.name))
        .sort(),
    };
  }
  const directory = join(cacheRoot, "microsandbox", "sessions");
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
  const appScope = createHash("sha256")
    .update(await realpath(appRoot))
    .digest("hex")
    .slice(0, 16);
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
    if (
      raw === undefined &&
      isUnrelatedLegacyKey(entry.name, appScope, family)
    ) {
      continue;
    }
    let parsed: unknown;
    try {
      parsed = raw === undefined ? undefined : JSON.parse(raw);
    } catch {
      parsed = undefined;
    }
    const owner = localEveSandboxOwnerSchema.safeParse(parsed);
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

function isUnrelatedLegacyKey(
  key: string,
  appScope: string,
  family: Set<string>
) {
  if (key.length > 120) {
    return false;
  }
  const match = legacyKeyPattern.exec(key);
  return Boolean(match && match[1] === appScope && !family.has(match[2]));
}
