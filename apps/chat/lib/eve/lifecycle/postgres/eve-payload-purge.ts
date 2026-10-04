import type { Sql, TransactionSql } from "postgres";
import { z } from "zod";

import { readEvePostgresQueueInventory } from "./eve-queue-inventory";
import { readEvePostgresRunInventoryInTransaction } from "./eve-run-inventory";

const receiptSchema = z.object({
  runIds: z.array(z.string()),
  streamIds: z.array(z.string()),
});

/* oxlint-disable no-magic-numbers, typescript/prefer-readonly-parameter-types --
 * no-magic-numbers (#517): assertPayloadPurgeReady uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/prefer-readonly-parameter-types (#565): assertPayloadPurgeReady accepts query: TransactionSql; inventory: { runIds: string[]; streamIds: string[]; }; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
const assertPayloadPurgeReady = async (
  query: TransactionSql,
  taskIdentifier: string,
  inventory: {
    runIds: string[];
    streamIds: string[];
  }
): Promise<void> => {
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
  if (configured.length === 0) {
    throw new Error("Install the queue fence before purging payloads.");
  }
  const queue = await readEvePostgresQueueInventory(query, {
    runIds: inventory.runIds,
    taskIdentifier,
  });
  if (queue.jobs.length > 0 || queue.unsupportedJobIds.length > 0) {
    throw new Error("Clear queued payloads before purging native runs.");
  }
};
/* oxlint-enable no-magic-numbers, typescript/prefer-readonly-parameter-types */

/* oxlint-disable jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, max-statements, no-magic-numbers, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions --
 * jsdoc/require-param (#534): purgeEvePostgresSessionPayloads's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): purgeEvePostgresSessionPayloads's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * max-lines-per-function (#510): purgeEvePostgresSessionPayloads keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): purgeEvePostgresSessionPayloads keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): purgeEvePostgresSessionPayloads uses 1, 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/explicit-function-return-type (#560): Keep purgeEvePostgresSessionPayloads's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep purgeEvePostgresSessionPayloads's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): purgeEvePostgresSessionPayloads accepts connection: Sql; input: { sessionId: string; taskIdentifier: string; }; query; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): purgeEvePostgresSessionPayloads intentionally keeps the existing falsy-value behavior of saved; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
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
        inventory.activeRunIds.length > 0 ||
        inventory.missingRunIds.length > 0 ||
        inventory.ambiguousStreamIds.length > 0
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
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, max-statements, no-magic-numbers, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */
