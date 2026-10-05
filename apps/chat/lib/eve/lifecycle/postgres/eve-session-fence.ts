import type { Sql } from "postgres";

import { fenceEvePostgresResourcesInTransaction } from "./eve-resource-fence";
import { readEvePostgresRunInventoryInTransaction } from "./eve-run-inventory";

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (fenceEvePostgresSession); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve fenceEvePostgresSession's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types --
 * jsdoc/require-param (#534): fenceEvePostgresSession's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): fenceEvePostgresSession's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * max-lines-per-function (#510): fenceEvePostgresSession keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): fenceEvePostgresSession keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): fenceEvePostgresSession uses 100, 1, 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/prefer-readonly-parameter-types (#565): fenceEvePostgresSession accepts connection: Sql; additionalRunIds: string[] = []; query; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
/**
 * Fence the reachable native run/stream graph for an authorized, retired session.
 * Unknown/unlinked resources, queues, sandboxes, and blobs remain outside this
 * provider boundary. No payloads are erased and this is not a deletion receipt.
 */
export const fenceEvePostgresSession = async (
  connection: Sql,
  sessionId: string,
  additionalRunIds: string[] = []
): Promise<{ runIds: string[]; streamIds: string[] }> =>
  await connection.begin("isolation level read committed", async (query) => {
    await fenceEvePostgresResourcesInTransaction(query, {
      runIds: [sessionId],
      streamIds: [],
    });
    const fencedRuns = new Set([sessionId]);
    const fencedStreams = new Set<string>();
    // A collector or descendant may admit a write before its own fence is held.
    // Re-read after acquiring those fences; each pass must cover new resources.
    for (let pass = 0; pass < 100; pass += 1) {
      // oxlint-disable-next-line eslint/no-await-in-loop -- Process one resource at a time so fencing and cleanup stay ordered and bounded.
      const inventory = await readEvePostgresRunInventoryInTransaction(
        query,
        sessionId,
        additionalRunIds
      );
      if (inventory.activeRunIds.length > 0) {
        throw new Error(
          "Retire all reachable runs before fencing this session."
        );
      }
      if (
        inventory.missingRunIds.length > 0 ||
        inventory.ambiguousStreamIds.length > 0
      ) {
        throw new Error(
          "Resolve missing runs and stream ownership before fencing this session."
        );
      }
      const runIds = inventory.runs.map((run) => run.id);
      if (
        runIds.every((id) => fencedRuns.has(id)) &&
        inventory.streamIds.every((id) => fencedStreams.has(id))
      ) {
        return { runIds, streamIds: inventory.streamIds };
      }
      // oxlint-disable-next-line eslint/no-await-in-loop -- Process one resource at a time so fencing and cleanup stay ordered and bounded.
      await fenceEvePostgresResourcesInTransaction(query, {
        runIds,
        streamIds: inventory.streamIds,
      });
      for (const id of runIds) {
        fencedRuns.add(id);
      }
      for (const id of inventory.streamIds) {
        fencedStreams.add(id);
      }
    }
    throw new Error("Session inventory did not stabilize; retry fencing.");
  });
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types */
