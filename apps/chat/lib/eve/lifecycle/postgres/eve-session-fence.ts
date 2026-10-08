import type { PostgresLifecycleQuery } from "./compatibility";
import type { Sql } from "postgres";
import { fenceEvePostgresResourcesInTransaction } from "./eve-resource-fence";
import { readEvePostgresRunInventoryInTransaction } from "./eve-run-inventory";

const FIRST_INVENTORY_PASS = 0;
const NEXT_INVENTORY_PASS = 1;
const MAX_INVENTORY_PASSES = 100;
const NO_RESOURCES = 0;

/* oxlint-disable oxc/no-async-await -- Postgres executes lazy queries when awaited; these helpers preserve transaction sequencing and rejected-Promise behavior. */
const readFenceableSessionInventory = async (
  query: PostgresLifecycleQuery,
  sessionId: string,
  additionalRunIds: readonly string[]
): Promise<{ runIds: string[]; streamIds: string[] }> => {
  const inventory = await readEvePostgresRunInventoryInTransaction(
    query,
    sessionId,
    additionalRunIds
  );
  if (inventory.activeRunIds.length > NO_RESOURCES) {
    throw new Error("Retire all reachable runs before fencing this session.");
  }
  if (
    inventory.missingRunIds.length > NO_RESOURCES ||
    inventory.ambiguousStreamIds.length > NO_RESOURCES
  ) {
    throw new Error(
      "Resolve missing runs and stream ownership before fencing this session."
    );
  }
  return {
    runIds: inventory.runs.map((run: { readonly id: string }) => run.id),
    streamIds: inventory.streamIds,
  };
};

// Record membership only after the caller's resource-fence write succeeds.
const recordFencedResources = (
  inventory: {
    readonly runIds: readonly string[];
    readonly streamIds: readonly string[];
  },
  tracking: {
    readonly runs: Readonly<Pick<Set<string>, "add">>;
    readonly streams: Readonly<Pick<Set<string>, "add">>;
  }
): void => {
  for (const id of inventory.runIds) {
    tracking.runs.add(id);
  }
  for (const id of inventory.streamIds) {
    tracking.streams.add(id);
  }
};

/* oxlint-disable import/prefer-default-export, import/no-named-export -- The application requires this named provider binding; import/no-default-export rejects the alternative. */
/**
 * Fence the reachable native run/stream graph for an authorized, retired session.
 * Unknown/unlinked resources, queues, sandboxes, and blobs remain outside this
 * provider boundary. No payloads are erased and this is not a deletion receipt.
 * @param {Sql} connection Native transaction-opening capability; the returned transaction remains the SDK's exact native type.
 * @param {string} sessionId Authorized, retired native session whose reachable resource graph is fenced.
 * @param {readonly string[]} additionalRunIds Retained run identities used as extra inventory seeds.
 * @returns {Promise<{ runIds: string[]; streamIds: string[] }>} Reachable identities once repeated fenced inventory stabilizes; rejects for active/missing runs, ambiguous ownership or exhausted retries.
 */
export const fenceEvePostgresSession = async (
  connection: Readonly<Pick<Sql, "begin">>,
  sessionId: string,
  additionalRunIds: readonly string[] = []
): Promise<{ runIds: string[]; streamIds: string[] }> =>
  await connection.begin(
    "isolation level read committed",
    async (query: PostgresLifecycleQuery) => {
      await fenceEvePostgresResourcesInTransaction(query, {
        runIds: [sessionId],
        streamIds: [],
      });
      const fencedRuns = new Set([sessionId]);
      const fencedStreams = new Set<string>();
      // A collector or descendant may admit a write before its own fence is held.
      // Re-read after acquiring those fences; each pass must cover new resources.
      for (
        let pass = FIRST_INVENTORY_PASS;
        pass < MAX_INVENTORY_PASSES;
        pass += NEXT_INVENTORY_PASS
      ) {
        // oxlint-disable-next-line eslint/no-await-in-loop -- Re-read only after the previous pass acquired its fences; concurrent snapshots could miss an admitted descendant.
        const inventory = await readFenceableSessionInventory(
          query,
          sessionId,
          additionalRunIds
        );
        if (
          inventory.runIds.every((id) => fencedRuns.has(id)) &&
          inventory.streamIds.every((id) => fencedStreams.has(id))
        ) {
          return inventory;
        }
        // oxlint-disable-next-line eslint/no-await-in-loop -- Finish every resource fence before recording membership and taking the next inventory snapshot.
        await fenceEvePostgresResourcesInTransaction(query, inventory);
        recordFencedResources(inventory, {
          runs: fencedRuns,
          streams: fencedStreams,
        });
      }
      throw new Error("Session inventory did not stabilize; retry fencing.");
    }
  );
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
