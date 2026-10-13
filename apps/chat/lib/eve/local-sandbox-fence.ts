import { mkdir, readdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import nodePath from "node:path";

// Conservative cleanup budget, independent of the filesystem worker pool size.
const MAX_CONCURRENT_FENCE_OPERATIONS = 4;

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
  // Drain each bounded batch before admitting more work or reporting failure.
  for (
    let offset = 0;
    offset < scopes.length;
    offset += MAX_CONCURRENT_FENCE_OPERATIONS
  ) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- Bound filesystem cleanup to four active marker chains; drain every started write before admitting the next batch or returning failure.
    const markers = await Promise.allSettled(
      scopes
        .slice(offset, offset + MAX_CONCURRENT_FENCE_OPERATIONS)
        .map(async (scope) => {
          await mkdir(scope, { recursive: true });
          await writeFile(nodePath.join(scope, "deleted"), "1\n", {
            flag: "wx",
            mode: 0o600,
          }).catch((error: unknown) => {
            if (
              !(
                error instanceof Error &&
                "code" in error &&
                error.code === "EEXIST"
              )
            ) {
              throw error;
            }
          });
        })
    );
    for (const marker of markers) {
      if (marker.status === "rejected") {
        throw marker.reason;
      }
    }
  }
  // Lease inspection starts only once every marker is written. Keep failures
  // in family order, independent of filesystem completion order.
  for (
    let offset = 0;
    offset < scopes.length;
    offset += MAX_CONCURRENT_FENCE_OPERATIONS
  ) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- Bound lease reads to four active requests; drain each inspection batch before admitting more or returning its first failure.
    const inspections = await Promise.allSettled(
      scopes
        .slice(offset, offset + MAX_CONCURRENT_FENCE_OPERATIONS)
        .map(async (scope) => {
          const operations = await readdir(
            nodePath.join(scope, "operations")
          ).catch((error: unknown) => {
            if (
              error instanceof Error &&
              "code" in error &&
              error.code === "ENOENT"
            ) {
              return [];
            }
            throw error;
          });
          if (operations.length > 0) {
            throw new Error(
              "Sandbox operations are still pending. Resolve them before cleanup."
            );
          }
        })
    );
    for (const inspection of inspections) {
      if (inspection.status === "rejected") {
        throw inspection.reason;
      }
    }
  }
};
