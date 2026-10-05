import type { Sql, TransactionSql } from "postgres";
import { z } from "zod";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { classifyEveSandboxRuns } from "@/lib/db/eve-sandbox-run-coverage";
/* oxlint-enable sort-imports */

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): runRow uses 1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 */
const runRow = z.object({
  collectorId: z.string().nullable(),
  eveParentId: z.string().nullable(),
  id: z.string(),
  parentId: z.string().nullable(),
  status: z.enum(["pending", "running", "completed", "failed", "cancelled"]),
  workflowName: z.string().min(1),
});
/* oxlint-enable no-magic-numbers */
const inventoryLimit = 10_000;

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve readEvePostgresRunInventoryInTransaction's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, max-statements, no-magic-numbers, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types -- jsdoc/require-param (#534): readEvePostgresRunInventoryInTransaction's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
jsdoc/require-returns (#535): readEvePostgresRunInventoryInTransaction's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
max-lines-per-function (#510): readEvePostgresRunInventoryInTransaction keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
max-statements (#512): readEvePostgresRunInventoryInTransaction keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
no-magic-numbers (#517): readEvePostgresRunInventoryInTransaction uses 1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
typescript/explicit-function-return-type (#560): Keep readEvePostgresRunInventoryInTransaction's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
typescript/explicit-module-boundary-types (#562): Keep readEvePostgresRunInventoryInTransaction's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
typescript/prefer-readonly-parameter-types (#565): readEvePostgresRunInventoryInTransaction accepts query: TransactionSql; additionalRunIds: string[] = []; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration. */
/** Caller controls isolation and holds any write fences needed by this read. */
const readEvePostgresRunInventoryInTransaction = async (
  query: TransactionSql,
  sessionId: string,
  additionalRunIds: string[] = []
) => {
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
  ].toSorted();
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
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, max-statements, no-magic-numbers, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types */

/* oxlint-disable jsdoc/require-param, jsdoc/require-returns, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types -- jsdoc/require-param (#534): readEvePostgresRunInventory's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
jsdoc/require-returns (#535): readEvePostgresRunInventory's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
typescript/explicit-function-return-type (#560): Keep readEvePostgresRunInventory's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
typescript/explicit-module-boundary-types (#562): Keep readEvePostgresRunInventory's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
typescript/prefer-readonly-parameter-types (#565): readEvePostgresRunInventory accepts connection: Sql; query; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration. */
/**
 * Read-only adapter for @workflow/world-postgres 5.0.0-beta.40.
 * The caller must authorize the session before using this internal primitive.
 * This snapshot inventories known run/stream relationships, not queue, sandbox,
 * or blob coverage. It is not a retirement barrier or a purge receipt.
 */
const readEvePostgresRunInventory = async (
  connection: Sql,
  sessionId: string
) =>
  await connection.begin(
    "isolation level repeatable read read only",
    async (query) =>
      await readEvePostgresRunInventoryInTransaction(query, sessionId)
  );
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types */
export {
  readEvePostgresRunInventory,
  readEvePostgresRunInventoryInTransaction,
};
