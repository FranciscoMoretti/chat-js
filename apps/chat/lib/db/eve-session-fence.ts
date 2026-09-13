import type { Sql } from "postgres";

import { fenceEvePostgresResourcesInTransaction } from "./eve-resource-fence";
import { readEvePostgresRunInventoryInTransaction } from "./eve-run-inventory";

/**
 * Fence the reachable native run/stream graph for an authorized, retired session.
 * Unknown/unlinked resources, queues, sandboxes, and blobs remain outside this
 * provider boundary. No payloads are erased and this is not a deletion receipt.
 */
export async function fenceEvePostgresSession(
  connection: Sql,
  sessionId: string,
  additionalRunIds: string[] = []
) {
  return await connection.begin(
    "isolation level read committed",
    async (query) => {
      await fenceEvePostgresResourcesInTransaction(query, {
        runIds: [sessionId],
        streamIds: [],
      });
      const fencedRuns = new Set([sessionId]);
      const fencedStreams = new Set<string>();
      // A collector or descendant may admit a write before its own fence is held.
      // Re-read after acquiring those fences; each pass must cover new resources.
      for (let pass = 0; pass < 100; pass++) {
        const inventory = await readEvePostgresRunInventoryInTransaction(
          query,
          sessionId,
          additionalRunIds
        );
        if (inventory.activeRunIds.length) {
          throw new Error(
            "Retire all reachable runs before fencing this session."
          );
        }
        if (
          inventory.missingRunIds.length ||
          inventory.ambiguousStreamIds.length
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
    }
  );
}
