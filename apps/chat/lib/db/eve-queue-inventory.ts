import type { Sql, TransactionSql } from "postgres";
import { z } from "zod";

/* oxlint-disable import/no-named-export, import/prefer-default-export, jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, no-magic-numbers, oxc/no-async-await, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types --
 * import/no-named-export (#527): Preserve the named readEvePostgresQueueInventory API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * import/prefer-default-export (#532): readEvePostgresQueueInventory remains a named API, consistent with no-default-export; adding future exports must not change caller import syntax.
 * jsdoc/require-param (#534): readEvePostgresQueueInventory's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): readEvePostgresQueueInventory's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * max-lines-per-function (#510): readEvePostgresQueueInventory keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): readEvePostgresQueueInventory uses 1, 10_000 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * oxc/no-async-await (#540): readEvePostgresQueueInventory sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * typescript/explicit-function-return-type (#560): Keep readEvePostgresQueueInventory's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep readEvePostgresQueueInventory's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): readEvePostgresQueueInventory accepts connection: Sql | TransactionSql; input: { runIds: string[]; taskIdentifier: string; }; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
/**
 * Internal metadata-only inventory for Workflow Postgres beta.40's Graphile
 * transport. Caller authorizes run IDs and supplies its configured queue task.
 * Includes resilient child creation even when its run row does not exist yet.
 * This read neither locks nor removes jobs; later cleanup must recheck ownership.
 */
export const readEvePostgresQueueInventory = async (
  connection: Sql | TransactionSql,
  input: {
    runIds: string[];
    taskIdentifier: string;
  }
) => {
  const { runIds, taskIdentifier } = z
    .object({
      runIds: z.array(z.string().min(1)).min(1).max(10_000),
      taskIdentifier: z.string().min(1),
    })
    .parse(input);
  const rows = z
    .array(
      z.object({
        id: z.string(),
        locked: z.boolean(),
        runId: z.string().nullable(),
        unsupported: z.boolean(),
      })
    )
    .parse(
      await connection`
    with messages as materialized (
      select job.id::text as id,
        (job.locked_at is not null or job.locked_by is not null) as locked,
        convert_from(decode(job.payload->>'data', 'base64'), 'UTF8')::jsonb as body
      from graphile_worker._private_jobs job
      join graphile_worker._private_tasks task on task.id = job.task_id
      where task.identifier = ${taskIdentifier}
    ), metadata as (
      select id, locked, body,
        case when jsonb_typeof(body->'runId') = 'string'
          then nullif(body->>'runId', '') end as run_id,
        coalesce(body->'__healthCheck' = 'true'::jsonb, false) as health_check
      from messages
    )
    select id, run_id as "runId", locked,
      (run_id is null and not health_check) as unsupported
    from metadata
    where (run_id is null and not health_check)
      or run_id in ${connection(runIds)}
      or body #>> '{runInput,attributes,$parentRunId}' in ${connection(runIds)}
      or body #>> '{runInput,attributes,$rootRunId}' in ${connection(runIds)}
      or body #>> '{runInput,attributes,$eve.parent}' in ${connection(runIds)}
      or body #>> '{runInput,attributes,$eve.root}' in ${connection(runIds)}
    order by id limit 10001
  `
    );
  if (rows.length > 10_000) {
    throw new Error("Queue inventory exceeds the supported limit.");
  }
  return {
    jobs: rows
      .filter((row) => !row.unsupported)
      .map(({ id, runId, locked }) => ({ id, locked, runId })),
    unsupportedJobIds: rows
      .filter((row) => row.unsupported)
      .map((row) => row.id),
  };
};
/* oxlint-enable import/no-named-export, import/prefer-default-export, jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, no-magic-numbers, oxc/no-async-await, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types */
