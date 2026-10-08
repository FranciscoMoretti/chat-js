import type { PostgresLifecycleQuery } from "./compatibility";
import { z } from "zod";

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (readEvePostgresQueueInventory); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve readEvePostgresQueueInventory's awaited sequencing and rejected-Promise behavior. */
const nonemptyStringLength = 1;
const queueInventoryLimit = 10_000;
const queueRows = z.array(
  z.object({
    id: z.string(),
    locked: z.boolean(),
    runId: z.string().nullable(),
    unsupported: z.boolean(),
  })
);

const readQueueMessages = async (
  connection: PostgresLifecycleQuery,
  runIds: readonly string[],
  taskIdentifier: string
): Promise<z.output<typeof queueRows>> =>
  queueRows.parse(
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

/**
 * Internal metadata-only inventory for Workflow Postgres beta.40's Graphile
 * transport. Caller authorizes run IDs and supplies its configured queue task.
 * Includes resilient child creation even when its run row does not exist yet.
 * This read neither locks nor removes jobs; later cleanup must recheck ownership.
 * @param {PostgresLifecycleQuery} connection Existing native connection or transaction for the configured queue metadata read.
 * @param {{ readonly runIds: readonly string[]; readonly taskIdentifier: string }} input Authorized native run identities and configured task; validated before querying.
 * @returns {Promise<{ jobs: { id: string; locked: boolean; runId: string | null }[]; unsupportedJobIds: string[] }>} Matching queued jobs, including parent/root associations, and task jobs lacking supported run metadata. Run-less health checks are excluded; oversized inventory rejects.
 */
export const readEvePostgresQueueInventory = async (
  connection: PostgresLifecycleQuery,
  input: {
    readonly runIds: readonly string[];
    readonly taskIdentifier: string;
  }
): Promise<{
  jobs: { id: string; locked: boolean; runId: string | null }[];
  unsupportedJobIds: string[];
}> => {
  const { runIds, taskIdentifier } = z
    .object({
      runIds: z
        .array(z.string().min(nonemptyStringLength))
        .min(nonemptyStringLength)
        .max(queueInventoryLimit),
      taskIdentifier: z.string().min(nonemptyStringLength),
    })
    .parse(input);
  const rows = await readQueueMessages(connection, runIds, taskIdentifier);
  if (rows.length > queueInventoryLimit) {
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
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
