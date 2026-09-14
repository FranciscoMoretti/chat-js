import type { Sql, TransactionSql } from "postgres";
import { z } from "zod";

import { readEvePostgresQueueInventory } from "./eve-queue-inventory";
import { readEvePostgresRunInventoryInTransaction } from "./eve-run-inventory";

const receiptSchema = z.object({
  runIds: z.array(z.string()),
  streamIds: z.array(z.string()),
});

const assertPayloadPurgeReady = async (
  query: TransactionSql,
  taskIdentifier: string,
  inventory: {
    runIds: string[];
    streamIds: string[];
  }
) => {
  const resources = [
    ...inventory.runIds.map((id) => `run:${id}`),
    ...inventory.streamIds.map((id) => `stream:${id}`),
  ];
  const guards = await query`select resource from workflow.eve_resource_fences
    where resource in ${query(resources)} and fenced = true for share`;
  if (guards.length !== resources.length) {
    throw new Error("Fence every run and stream before purging payloads.");
  }
  const configured =
    await query`select identifier from workflow.eve_queue_tasks where identifier = ${taskIdentifier}`;
  if (!configured.length) {
    throw new Error("Install the queue fence before purging payloads.");
  }
  const queue = await readEvePostgresQueueInventory(query, {
    runIds: inventory.runIds,
    taskIdentifier,
  });
  if (queue.jobs.length || queue.unsupportedJobIds.length) {
    throw new Error("Clear queued payloads before purging native runs.");
  }
};

/**
 * Erase the pinned provider's fenced payload tables for an authorized session.
 * Retains only resource identities as an atomic retry receipt. Accounting and
 * application tables are untouched. This is not sandbox/blob or full app deletion.
 */
export const purgeEvePostgresSessionPayloads = async (
  connection: Sql,
  input: {
    sessionId: string;
    taskIdentifier: string;
  }
) => {
  const scope = z
    .object({ sessionId: z.string().min(1), taskIdentifier: z.string().min(1) })
    .parse(input);
  return await connection.begin(
    "isolation level read committed",
    async (query) => {
      // Shared with queue cleanup, which persists additional run associations.
      await query`select pg_advisory_xact_lock(hashtextextended(${`eve-queue-purge:${scope.taskIdentifier}:${scope.sessionId}`}, 0))`;
      const [saved] =
        await query`select run_ids as "runIds", stream_ids as "streamIds"
      from workflow.eve_payload_purges where session_id = ${scope.sessionId} and task_identifier = ${scope.taskIdentifier}`;
      if (saved) {
        return receiptSchema.parse(saved);
      }
      const retained = z.array(z.object({ id: z.string() })).parse(
        await query`
      select run_id as id from workflow.eve_queue_purge_runs
      where session_id = ${scope.sessionId} and task_identifier = ${scope.taskIdentifier}`
      );
      const inventory = await readEvePostgresRunInventoryInTransaction(
        query,
        scope.sessionId,
        retained.map((run) => run.id)
      );
      if (
        inventory.activeRunIds.length ||
        inventory.missingRunIds.length ||
        inventory.ambiguousStreamIds.length
      ) {
        throw new Error(
          "Resolve active runs and incomplete resource ownership before purging."
        );
      }
      const runIds = [
        ...new Set([
          ...inventory.runs.map((run) => run.id),
          ...retained.map((run) => run.id),
        ]),
      ].toSorted();
      const receipt = { runIds, streamIds: inventory.streamIds };
      await assertPayloadPurgeReady(query, scope.taskIdentifier, receipt);
      await query`delete from workflow.workflow_stream_chunks where run_id in ${query(runIds)}`;
      await query`delete from workflow.workflow_events where run_id in ${query(runIds)}`;
      await query`delete from workflow.workflow_event_slots where run_id in ${query(runIds)}`;
      await query`delete from workflow.workflow_steps where run_id in ${query(runIds)}`;
      await query`delete from workflow.workflow_hooks where run_id in ${query(runIds)}`;
      await query`delete from workflow.workflow_waits where run_id in ${query(runIds)}`;
      await query`delete from workflow.workflow_runs where id in ${query(runIds)}`;
      await query`insert into workflow.eve_payload_purges(session_id, task_identifier, run_ids, stream_ids)
      values (${scope.sessionId}, ${scope.taskIdentifier}, ${query.array(runIds)}::text[], ${query.array(receipt.streamIds)}::text[])`;
      return receipt;
    }
  );
};
