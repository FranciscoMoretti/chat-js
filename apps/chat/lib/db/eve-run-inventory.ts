import type { Sql, TransactionSql } from "postgres";
import { z } from "zod";

import { classifyEveSandboxRuns } from "./eve-sandbox-run-coverage";

const runRow = z.object({
  id: z.string(),
  workflowName: z.string().min(1),
  status: z.enum(["pending", "running", "completed", "failed", "cancelled"]),
  parentId: z.string().nullable(),
  eveParentId: z.string().nullable(),
  collectorId: z.string().nullable(),
});
const inventoryLimit = 10_000;

/**
 * Read-only adapter for @workflow/world-postgres 5.0.0-beta.40.
 * The caller must authorize the session before using this internal primitive.
 * This snapshot inventories known run/stream relationships, not queue, sandbox,
 * or blob coverage. It is not a retirement barrier or a purge receipt.
 */
export async function readEvePostgresRunInventory(
  connection: Sql,
  sessionId: string
) {
  return await connection.begin(
    "isolation level repeatable read read only",
    async (query) => {
      return await readEvePostgresRunInventoryInTransaction(query, sessionId);
    }
  );
}

/** Caller controls isolation and holds any write fences needed by this read. */
export async function readEvePostgresRunInventoryInTransaction(
  query: TransactionSql,
  sessionId: string,
  additionalRunIds: string[] = []
) {
  const seeds = [...new Set([sessionId, ...additionalRunIds])];
  const runs = z.array(runRow).parse(
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
    order by run.id limit ${inventoryLimit + 1}
  `
  );
  if (!runs.some((run) => run.id === sessionId)) {
    throw new Error("The session run is missing; inventory is incomplete.");
  }
  if (runs.length > inventoryLimit) {
    throw new Error("Run inventory exceeds the supported limit.");
  }
  const runIds = runs.map((run) => run.id);
  const known = new Set(runIds);
  // Queue envelopes can be the only retained association to a run. Absence of
  // its row does not prove it never executed or allocated external resources.
  const missingRunIds = [
    ...new Set([
      ...seeds.filter((id) => !known.has(id)),
      ...runs.flatMap((run) =>
        [run.parentId, run.eveParentId, run.collectorId].filter(
          (id): id is string => id !== null && !known.has(id)
        )
      ),
    ]),
  ].sort();
  const streams = z.array(z.object({ id: z.string() })).parse(
    await query`
    select distinct stream_id as id from workflow.workflow_stream_chunks
    where run_id in ${query(runIds)}
    order by stream_id limit ${inventoryLimit + 1}
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
    order by candidate.stream_id limit ${inventoryLimit + 1}
  `
  );
  return {
    runs,
    sandboxCoverage: classifyEveSandboxRuns(runs),
    streamIds: streams.map((stream) => stream.id),
    activeRunIds: runs
      .filter((run) => run.status === "running" || run.status === "pending")
      .map((run) => run.id),
    missingRunIds,
    ambiguousStreamIds: ambiguous.map((stream) => stream.id),
  };
}
