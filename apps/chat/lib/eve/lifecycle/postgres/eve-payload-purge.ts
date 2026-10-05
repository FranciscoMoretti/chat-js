import type { Sql, TransactionSql } from "postgres";
import { z } from "zod";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { readEvePostgresQueueInventory } from "./eve-queue-inventory";
/* oxlint-enable sort-imports */
import { readEvePostgresRunInventoryInTransaction } from "./eve-run-inventory";

const receiptSchema = z.object({
  runIds: z.array(z.string()),
  streamIds: z.array(z.string()),
});

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve assertPayloadPurgeReady's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): assertPayloadPurgeReady uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 */
const assertPayloadPurgeReady = async (
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Preserve TransactionSql's overloaded callable tag/helper and native query-array capability used to verify fences and configured queue state.
  query: TransactionSql,
  taskIdentifier: string,
  inventory: {
    readonly runIds: readonly string[];
    readonly streamIds: readonly string[];
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
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (purgeEvePostgresSessionPayloads); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve purgeEvePostgresSessionPayloads's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers */

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, typescript/strict-boolean-expressions --
 * max-lines-per-function (#510): purgeEvePostgresSessionPayloads keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): purgeEvePostgresSessionPayloads keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): purgeEvePostgresSessionPayloads uses 1, 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/strict-boolean-expressions (#610): purgeEvePostgresSessionPayloads intentionally keeps the existing falsy-value behavior of saved; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
/**
 * Erase the pinned provider's fenced payload tables for an authorized session.
 * Retains only resource identities as an atomic retry receipt. Accounting and
 * application tables are untouched. This is not sandbox/blob or full app deletion.
 * @param {Readonly<Pick<Sql, "begin">>} connection Native transaction-opening capability; query callbacks retain native transaction types.
 * @param {{ readonly sessionId: string; readonly taskIdentifier: string }} input Authorized retired session and configured queue task, validated before opening the purge transaction.
 * @returns {Promise<{ runIds: string[]; streamIds: string[] }>} Atomic resource-identity retry receipt after fenced native payload deletion, or the validated previously saved receipt. Rejects if ownership, retirement, fences or queue-clearance checks fail.
 */
export const purgeEvePostgresSessionPayloads = async (
  connection: Readonly<Pick<Sql, "begin">>,
  input: {
    readonly sessionId: string;
    readonly taskIdentifier: string;
  }
): Promise<{ runIds: string[]; streamIds: string[] }> => {
  const scope = z
    .object({ sessionId: z.string().min(1), taskIdentifier: z.string().min(1) })
    .parse(input);
  return await connection.begin(
    "isolation level read committed",
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Native transaction callback must retain callable SQL tag/helper and array encoding methods for the locked payload purge and receipt insert.
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
        retained.map((run: { readonly id: string }) => run.id)
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
          ...inventory.runs.map((run: { readonly id: string }) => run.id),
          ...retained.map((run: { readonly id: string }) => run.id),
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
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, typescript/strict-boolean-expressions */
