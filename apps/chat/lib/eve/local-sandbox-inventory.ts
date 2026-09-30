import { readdir, readFile } from "node:fs/promises";
import nodePath from "node:path";

import { z } from "zod";

export const localEveSandboxOwnerSchema = z.strictObject({
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
 */
export const readLocalEveSandboxInventory = async (
  appRoot: string,
  sessionIds: string[]
) => {
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
    (entry) => entry.name !== "microsandbox" || !entry.isDirectory()
  );
  if (unsupported.length) {
    return {
      owned: [],
      unattributedDirectories: unsupported
        .map((entry) => nodePath.join(cacheRoot, entry.name))
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
  for (const entry of entries.toSorted((a, b) =>
    a.name.localeCompare(b.name)
  )) {
    const sessionDirectory = nodePath.join(directory, entry.name);
    // Do not traverse symlinks or unexpected files in the provider cache.
    if (!entry.isDirectory()) {
      unattributedDirectories.push(sessionDirectory);
      continue;
    }
    // oxlint-disable-next-line eslint/no-await-in-loop -- Process one resource at a time so fencing and cleanup stay ordered and bounded.
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
};
