import { readFile, readdir } from "node:fs/promises";
import nodePath from "node:path";

import { z } from "zod";

const localEveSandboxOwnerSchema = z.strictObject({
  backendName: z.literal("microsandbox"),
  sessionId: z.string().min(1),
  sessionKey: z.string().min(1),
  version: z.literal(1),
  writeAheadResources: z.literal(true).optional(),
});

/**
 * Internal local inventory. The caller authorizes and retires the native family
 * before using its session IDs. Unattributed directories prevent proof of full
 * coverage. Only explicit owner records establish resource ownership.
 * @param {string} appRoot Trusted local worker root containing the native sandbox cache.
 * @param {readonly string[]} sessionIds Authorized, retired native family session identities; not mutated by inventory.
 * @returns {Promise<{ owned: { sessionDirectory: string; sessionKey: string }[]; unattributedDirectories: string[] }>} Explicitly owned microsandbox directories and unattributed evidence. Missing caches yield empty lists; unsupported backends and invalid owner records prevent proof of coverage.
 */
const readLocalEveSandboxInventory = async (
  appRoot: string,
  sessionIds: readonly string[]
): Promise<{
  owned: { sessionDirectory: string; sessionKey: string }[];
  unattributedDirectories: string[];
}> => {
  const cacheRoot = nodePath.join(appRoot, ".eve", "sandbox-cache");
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
    (entry: { readonly name: string; readonly isDirectory: () => boolean }) =>
      entry.name !== "microsandbox" || !entry.isDirectory()
  );
  if (unsupported.length > 0) {
    return {
      owned: [],
      unattributedDirectories: unsupported
        .map((entry: { readonly name: string }) =>
          nodePath.join(cacheRoot, entry.name)
        )
        .toSorted(),
    };
  }
  const directory = nodePath.join(cacheRoot, "microsandbox", "sessions");
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
  const owned: {
    sessionDirectory: string;
    sessionKey: string;
  }[] = [];
  const unattributedDirectories: string[] = [];
  for (const entry of entries.toSorted(
    (
      leftEntry: { readonly name: string },
      rightEntry: { readonly name: string }
    ) => leftEntry.name.localeCompare(rightEntry.name)
  )) {
    const sessionDirectory = nodePath.join(directory, entry.name);
    // Do not traverse symlinks or unexpected files in the provider cache.
    if (!entry.isDirectory()) {
      unattributedDirectories.push(sessionDirectory);
      continue;
    }
    // oxlint-disable-next-line eslint/no-await-in-loop -- Read and classify sorted owner.json records one at a time to bound raw owner-file memory and preserve deterministic owned/unattributed output.
    const raw = await readFile(
      nodePath.join(sessionDirectory, "owner.json"),
      "utf-8"
    ).catch((error: unknown) => {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        return;
      }
      throw error;
    });
    let parsed: unknown = raw;
    try {
      if (typeof raw === "string") {
        parsed = JSON.parse(raw);
      }
    } catch {
      // Malformed JSON remains a string and fails the owner object schema below.
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
};
export { localEveSandboxOwnerSchema, readLocalEveSandboxInventory };
