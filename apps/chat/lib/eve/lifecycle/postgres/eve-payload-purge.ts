import type { Sql, TransactionSql } from "postgres";
import type { PostgresLifecycleQuery } from "./compatibility";
import { readEvePostgresQueueInventory } from "./eve-queue-inventory";
import { readEvePostgresRunInventoryInTransaction } from "./eve-run-inventory";
import { z } from "zod";

const EMPTY_COUNT = 0;
const MIN_IDENTIFIER_LENGTH = 1;
type PayloadQuery = PostgresLifecycleQuery & {
  readonly array: TransactionSql["array"];
};

const receiptSchema = z.object({
  runIds: z.array(z.string()),
  streamIds: z.array(z.string()),
});

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve assertPayloadPurgeReady's awaited sequencing and rejected-Promise behavior. */

const assertPayloadPurgeReady = async (
  query: PayloadQuery,
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
  if (configured.length === EMPTY_COUNT) {
    throw new Error("Install the queue fence before purging payloads.");
  }
  const queue = await readEvePostgresQueueInventory(query, {
    runIds: inventory.runIds,
    taskIdentifier,
  });
  if (
    queue.jobs.length > EMPTY_COUNT ||
    queue.unsupportedJobIds.length > EMPTY_COUNT
  ) {
    throw new Error("Clear queued payloads before purging native runs.");
  }
};
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (purgeEvePostgresSessionPayloads); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve purgeEvePostgresSessionPayloads's awaited sequencing and rejected-Promise behavior. */

const inventoryPayloadPurge = async (
  query: PayloadQuery,
  sessionId: string,
  taskIdentifier: string
): Promise<{ runIds: string[]; streamIds: string[] }> => {
  const retained = z.array(z.object({ id: z.string() })).parse(
    await query`
  select run_id as id from workflow.eve_queue_purge_runs
  where session_id = ${sessionId} and task_identifier = ${taskIdentifier}`
  );
  const inventory = await readEvePostgresRunInventoryInTransaction(
    query,
    sessionId,
    retained.map((run: { readonly id: string }) => run.id)
  );
  if (
    inventory.activeRunIds.length > EMPTY_COUNT ||
    inventory.missingRunIds.length > EMPTY_COUNT ||
    inventory.ambiguousStreamIds.length > EMPTY_COUNT
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
  return receipt;
};

const erasePayloadInventory = async (
  query: PayloadQuery,
  receipt: {
    readonly runIds: readonly string[];
    readonly streamIds: readonly string[];
  }
): Promise<void> => {
  await query`delete from workflow.workflow_stream_chunks where run_id in ${query(receipt.runIds)}`;
  await query`delete from workflow.workflow_events where run_id in ${query(receipt.runIds)}`;
  await query`delete from workflow.workflow_event_slots where run_id in ${query(receipt.runIds)}`;
  await query`delete from workflow.workflow_steps where run_id in ${query(receipt.runIds)}`;
  await query`delete from workflow.workflow_hooks where run_id in ${query(receipt.runIds)}`;
  await query`delete from workflow.workflow_waits where run_id in ${query(receipt.runIds)}`;
  await query`delete from workflow.workflow_runs where id in ${query(receipt.runIds)}`;
};
/**
 * Erase the pinned provider's fenced payload tables for an authorized session.
 * Retains only resource identities as an atomic retry receipt. Accounting and
 * application tables are untouched. This is not sandbox/blob or full app deletion.
 * @param {Sql} connection Native transaction-opening capability; query callbacks retain native transaction types.
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
    .object({
      sessionId: z.string().min(MIN_IDENTIFIER_LENGTH),
      taskIdentifier: z.string().min(MIN_IDENTIFIER_LENGTH),
    })
    .parse(input);
  return await connection.begin(
    "isolation level read committed",

    async (query: PayloadQuery) => {
      // Shared with queue cleanup, which persists additional run associations.
      await query`select pg_advisory_xact_lock(hashtextextended(${`eve-queue-purge:${scope.taskIdentifier}:${scope.sessionId}`}, 0))`;
      const savedRows: readonly (object | undefined)[] =
        await query`select run_ids as "runIds", stream_ids as "streamIds"
      from workflow.eve_payload_purges where session_id = ${scope.sessionId} and task_identifier = ${scope.taskIdentifier}`;
      const [saved] = savedRows;
      if (saved) {
        return receiptSchema.parse(saved);
      }
      const receipt = await inventoryPayloadPurge(
        query,
        scope.sessionId,
        scope.taskIdentifier
      );
      await assertPayloadPurgeReady(query, scope.taskIdentifier, receipt);
      await erasePayloadInventory(query, receipt);
      await query`insert into workflow.eve_payload_purges(session_id, task_identifier, run_ids, stream_ids)
  values (${scope.sessionId}, ${scope.taskIdentifier}, ${query.array(receipt.runIds)}::text[], ${query.array(receipt.streamIds)}::text[])`;
      return receipt;
    }
  );
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
