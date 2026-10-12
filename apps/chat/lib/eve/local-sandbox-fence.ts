import { mkdir, readdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import nodePath from "node:path";

/**
 * Permanently stop new local sandbox operations for an authorized native family.
 * Existing operation records must disappear before inventory and cleanup proceed.
 * Never expire or discard unresolved records on a timer: provider work may remain.
 * @param {string} appRoot - Application root containing the local .eve mutation journal.
 * @param {readonly string[]} sessionIds - Authorized family members to fence; duplicates share one marker.
 */
export const fenceLocalEveSandboxMutations = async (
  appRoot: string,
  sessionIds: readonly string[]
): Promise<void> => {
  const scopes = [...new Set(sessionIds)].map((id) =>
    nodePath.join(
      appRoot,
      ".eve",
      "sandbox-mutations",
      createHash("sha256").update(id).digest("hex")
    )
  );
  for (const scope of scopes) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- Create every family deletion marker before inspecting operation leases; each write depends on mkdir, and pending work must fail closed without expiring a lease.
    await mkdir(scope, { recursive: true });
    // oxlint-disable-next-line eslint/no-await-in-loop -- Create every family deletion marker before inspecting operation leases; each write depends on mkdir, and pending work must fail closed without expiring a lease.
    await writeFile(nodePath.join(scope, "deleted"), "1\n", {
      flag: "wx",
      mode: 0o600,
    }).catch((error: unknown) => {
      if (
        !(error instanceof Error && "code" in error && error.code === "EEXIST")
      ) {
        throw error;
      }
    });
  }
  for (const scope of scopes) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- Create every family deletion marker before inspecting operation leases; each write depends on mkdir, and pending work must fail closed without expiring a lease.
    const operations = await readdir(nodePath.join(scope, "operations")).catch(
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
    if (operations.length > 0) {
      throw new Error(
        "Sandbox operations are still pending. Resolve them before cleanup."
      );
    }
  }
};
