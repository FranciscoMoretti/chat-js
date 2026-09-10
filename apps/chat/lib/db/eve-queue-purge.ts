import type { Sql, TransactionSql } from "postgres";
import { z } from "zod";
import { readEvePostgresQueueInventory } from "./eve-queue-inventory";
import { fenceEvePostgresResourcesInTransaction } from "./eve-resource-fence";

/**
 * Remove queued payloads for an authorized resource set already fenced by the
 * session coordinator. Returns newly discovered queued run IDs for the caller's
 * deletion inventory. Never force-unlocks workers or claims full session purge.
 */
export async function purgeEvePostgresQueue(
  connection: Sql,
  input: { sessionId: string; runIds: string[]; taskIdentifier: string }
) {
  const parsed = z
    .object({
      sessionId: z.string().min(1),
      runIds: z.array(z.string().min(1)).min(1).max(10_000),
      taskIdentifier: z.string().min(1),
    })
    .parse(input);
  if (!parsed.runIds.includes(parsed.sessionId)) {
    throw new Error("Include the session root in the queue cleanup inventory.");
  }
  return await connection.begin(
    "isolation level read committed",
    async (query) => {
      await query`select pg_advisory_xact_lock(hashtextextended(${`eve-queue-purge:${parsed.taskIdentifier}:${parsed.sessionId}`}, 0))`;
      const configured =
        await query`select identifier from workflow.eve_queue_tasks
      where identifier = ${parsed.taskIdentifier}`;
      if (!configured.length) {
        throw new Error("Install the queue fence before removing payloads.");
      }
      const retained = z.array(z.object({ id: z.string() })).parse(
        await query`select run_id as id from workflow.eve_queue_purge_runs
          where session_id = ${parsed.sessionId} and task_identifier = ${parsed.taskIdentifier}`
      );
      const known = new Set([
        ...parsed.runIds,
        ...retained.map((run) => run.id),
      ]);
      const guards =
        await query`select resource from workflow.eve_resource_fences
      where resource in ${query([...known].map((id) => `run:${id}`))} and fenced = true for share`;
      if (guards.length !== known.size) {
        throw new Error("Fence all runs before removing queued payloads.");
      }

      for (let pass = 0; pass < 100; pass++) {
        const inventory = await readEvePostgresQueueInventory(query, {
          runIds: [...known],
          taskIdentifier: parsed.taskIdentifier,
        });
        if (inventory.unsupportedJobIds.length) {
          throw new Error("Resolve unsupported queue messages before cleanup.");
        }
        if (inventory.jobs.some((job) => job.locked)) {
          throw new Error("Wait for active queue workers before cleanup.");
        }
        const newIds = inventory.jobs.flatMap((job) =>
          job.runId && !known.has(job.runId) ? [job.runId] : []
        );
        if (newIds.length) {
          for (const id of newIds) {
            known.add(id);
          }
          await fenceEvePostgresResourcesInTransaction(query, {
            runIds: [...known],
            streamIds: [],
          });
          continue;
        }
        // Keep discovered identities durably before dropping their last queued
        // association. A lost response can then retry without losing child IDs.
        await query`insert into workflow.eve_queue_purge_runs (session_id, task_identifier, run_id)
          select ${parsed.sessionId}, ${parsed.taskIdentifier}, id
          from unnest(${query.array([...known])}::text[]) id on conflict do nothing`;
        return {
          removedJobIds: await removeUnlockedJobs(
            query,
            inventory.jobs.map((job) => job.id)
          ),
          runIds: [...known].sort(),
        };
      }
      throw new Error("Queue inventory did not stabilize; retry cleanup.");
    }
  );
}

async function removeUnlockedJobs(query: TransactionSql, jobIds: string[]) {
  if (!jobIds.length) {
    return [];
  }
  const locked = z
    .array(z.object({ id: z.string(), active: z.boolean() }))
    .parse(
      await query`select id::text, (locked_at is not null or locked_by is not null) as active
          from graphile_worker._private_jobs
          where id::text in ${query(jobIds)}
          order by id for update`
    );
  // A worker may have claimed a job between inventory and row locking.
  if (locked.some((job) => job.active)) {
    throw new Error("Wait for active queue workers before cleanup.");
  }
  const removed = locked.length
    ? z
        .array(z.object({ id: z.string() }))
        .parse(
          await query`select id::text from graphile_worker.complete_jobs(${query.array(locked.map((job) => job.id))}::bigint[])`
        )
    : [];
  if (removed.length !== locked.length) {
    throw new Error("Queue cleanup did not remove every locked job.");
  }
  return removed.map((job) => job.id).sort();
}
