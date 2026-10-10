import type { PostgresLifecycleQuery } from "./compatibility";
import type { Sql } from "postgres";
import { classifyEveSandboxRuns } from "@/lib/db/eve-sandbox-run-coverage";
import { z } from "zod";

const nonemptyWorkflowNameLength = 1;
const runRow = z.object({
  collectorId: z.string().nullable(),
  eveParentId: z.string().nullable(),
  id: z.string(),
  parentId: z.string().nullable(),
  status: z.enum(["pending", "running", "completed", "failed", "cancelled"]),
  workflowName: z.string().min(nonemptyWorkflowNameLength),
});
const inventoryLimit = 10_000;
const overflowRowCount = 1;

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve readEvePostgresRunInventoryInTransaction's awaited sequencing and rejected-Promise behavior. */
const readFamilyRuns = async (
  query: PostgresLifecycleQuery,
  seeds: readonly string[]
): Promise<z.output<typeof runRow>[]> =>
  z.array(runRow).parse(
    await query`
    with recursive family(id, collector_id) as (
      select id, attributes->>'$eve.activity_collector'
      from workflow.workflow_runs
          where id in ${query(seeds)}
            or attributes->>'$rootRunId' in ${query(seeds)}
            or attributes->>'$eve.root' in ${query(seeds)}
      union
      select child.id, child.attributes->>'$eve.activity_collector'
      from workflow.workflow_runs child
      join family parent on
        child.attributes->>'$parentRunId' = parent.id
        or child.attributes->>'$eve.parent' = parent.id
        or child.id = parent.collector_id
    )
    select run.id, run.name as "workflowName", run.status,
      run.attributes->>'$parentRunId' as "parentId",
      run.attributes->>'$eve.parent' as "eveParentId",
      run.attributes->>'$eve.activity_collector' as "collectorId"
    from workflow.workflow_runs run join family on family.id = run.id
    order by run.id limit ${inventoryLimit + overflowRowCount}
  `
  );

const collectMissingRunIds = (
  runIds: readonly string[],
  seeds: readonly string[],
  runs: readonly Readonly<z.output<typeof runRow>>[]
): string[] => {
  const known = new Set(runIds);
  // Queue envelopes can be the only retained association to a run. Absence of
  // its row does not prove it never executed or allocated external resources.
  return [
    ...new Set([
      ...seeds.filter((id) => !known.has(id)),
      ...runs.flatMap((run) =>
        [run.parentId, run.eveParentId, run.collectorId].filter(
          (id): id is string => id !== null && !known.has(id)
        )
      ),
    ]),
  ].toSorted();
};

const readAssociatedStreams = async (
  query: PostgresLifecycleQuery,
  runIds: readonly string[]
): Promise<{
  ambiguous: Readonly<{ id: string }>[];
  streams: Readonly<{ id: string }>[];
}> => {
  const streams = z.array(z.object({ id: z.string() })).parse(
    await query`
    select distinct stream_id as id from workflow.workflow_stream_chunks
    where run_id in ${query(runIds)}
    order by stream_id limit ${inventoryLimit + overflowRowCount}
  `
  );
  if (streams.length > inventoryLimit) {
    throw new Error("Stream inventory exceeds the supported limit.");
  }
  // A stream can contain chunks associated with another run (or no run).
  // Surface that ambiguity instead of treating its name as exclusive ownership.
  const ambiguous = z.array(z.object({ id: z.string() })).parse(
    await query`
    select distinct candidate.stream_id as id
    from workflow.workflow_stream_chunks candidate
    where (candidate.run_id is null or candidate.run_id not in ${query(runIds)})
      and exists (
        select 1 from workflow.workflow_stream_chunks owned
        where owned.stream_id = candidate.stream_id
          and owned.run_id in ${query(runIds)}
      )
    order by candidate.stream_id limit ${inventoryLimit + overflowRowCount}
  `
  );
  return { ambiguous, streams };
};

/** Caller controls isolation and holds any write fences needed by this read.
 * @param {PostgresLifecycleQuery} query Native transaction used for the recursive run graph and associated stream reads.
 * @param {string} sessionId Authorized native session identity that must exist in the returned run graph.
 * @param {readonly string[]} additionalRunIds Retained run identities added as graph seeds, without mutating the supplied list.
 * @returns {Promise<{ activeRunIds: string[]; ambiguousStreamIds: string[]; missingRunIds: string[]; runs: z.output<typeof runRow>[]; sandboxCoverage: ReturnType<typeof classifyEveSandboxRuns>; streamIds: string[] }>} Validated runs and associated streams, active run identities, unresolved declared run references, streams shared with unrelated or unassigned chunks, and ancestry-only sandbox classification. Rejects on missing session rows, invalid provider rows or oversized run/stream lists; this snapshot does not authorize deletion.
 */
const readEvePostgresRunInventoryInTransaction = async (
  query: PostgresLifecycleQuery,
  sessionId: string,
  additionalRunIds: readonly string[] = []
): Promise<{
  activeRunIds: string[];
  ambiguousStreamIds: string[];
  missingRunIds: string[];
  runs: z.output<typeof runRow>[];
  sandboxCoverage: ReturnType<typeof classifyEveSandboxRuns>;
  streamIds: string[];
}> => {
  const seeds = [...new Set([sessionId, ...additionalRunIds])];
  const runs = await readFamilyRuns(query, seeds);
  if (!runs.some((run) => run.id === sessionId)) {
    throw new Error("The session run is missing; inventory is incomplete.");
  }
  if (runs.length > inventoryLimit) {
    throw new Error("Run inventory exceeds the supported limit.");
  }
  const runIds = runs.map((run) => run.id);
  const missingRunIds = collectMissingRunIds(runIds, seeds, runs);
  const { ambiguous, streams } = await readAssociatedStreams(query, runIds);
  return {
    activeRunIds: runs
      .filter((run) => run.status === "running" || run.status === "pending")
      .map((run) => run.id),
    ambiguousStreamIds: ambiguous.map((stream) => stream.id),
    missingRunIds,
    runs,
    sandboxCoverage: classifyEveSandboxRuns(runs),
    streamIds: streams.map((stream) => stream.id),
  };
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve readEvePostgresRunInventory's awaited sequencing and rejected-Promise behavior. */

/**
 * Read-only adapter for @workflow/world-postgres 5.0.0-beta.40.
 * The caller must authorize the session before using this internal primitive.
 * This snapshot inventories known run/stream relationships, not queue, sandbox,
 * or blob coverage. It is not a retirement barrier or a purge receipt.
 * @param {Sql} connection Native transaction-opening capability used to establish a repeatable-read read-only snapshot.
 * @param {string} sessionId Caller-authorized native session identity whose graph is requested.
 * @returns {ReturnType<typeof readEvePostgresRunInventoryInTransaction>} The same validated run/stream inventory as the transaction reader, under the opened snapshot; rejects when inventory validation or the native transaction fails.
 */
const readEvePostgresRunInventory = async (
  connection: { readonly begin: Sql["begin"] },
  sessionId: string
): ReturnType<typeof readEvePostgresRunInventoryInTransaction> =>
  await connection.begin(
    "isolation level repeatable read read only",

    async (query: PostgresLifecycleQuery) =>
      await readEvePostgresRunInventoryInTransaction(query, sessionId)
  );
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (readEvePostgresRunInventory, readEvePostgresRunInventoryInTransaction); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable oxc/no-async-await */
export {
  readEvePostgresRunInventory,
  readEvePostgresRunInventoryInTransaction,
};
/* oxlint-enable import/no-named-export */
