import type { Sql, TransactionSql } from "postgres";
import type { PostgresLifecycleQuery } from "./compatibility";
import { fenceEvePostgresResourcesInTransaction } from "./eve-resource-fence";
import { readEvePostgresQueueInventory } from "./eve-queue-inventory";
import { z } from "zod";

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve removeUnlockedJobs's awaited sequencing and rejected-Promise behavior. */

const EMPTY_COUNT = 0;
const MIN_IDENTIFIER_LENGTH = 1;
const MIN_QUEUE_RUNS = 1;
const MAX_INVENTORY_SIZE = 10_000;
const MAX_DISCOVERY_PASSES = 100;
const NEXT_DISCOVERY_PASS = 1;
type QueueQuery = PostgresLifecycleQuery & {
  readonly array: TransactionSql["array"];
};
interface QueueInventory {
  readonly jobs: readonly {
    readonly id: string;
    readonly locked: boolean;
    readonly runId: string | null;
  }[];
  readonly unsupportedJobIds: readonly string[];
}

const assertCompleteQueueRemoval = (
  removed: readonly { readonly id: string }[],
  locked: readonly { readonly id: string }[]
): void => {
  if (removed.length !== locked.length) {
    throw new Error("Queue cleanup did not remove every locked job.");
  }
};

const removeUnlockedJobs = async (
  query: QueueQuery,
  jobIds: readonly string[]
): Promise<string[]> => {
  if (jobIds.length === EMPTY_COUNT) {
    return [];
  }
  const locked = z
    .array(z.object({ active: z.boolean(), id: z.string() }))
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
  if (locked.length === EMPTY_COUNT) {
    return [];
  }
  const removed = z
    .array(z.object({ id: z.string() }))
    .parse(
      await query`select id::text from graphile_worker.complete_jobs(${query.array(locked.map((job) => job.id))}::bigint[])`
    );
  assertCompleteQueueRemoval(removed, locked);
  return removed.map((job) => job.id).toSorted();
};
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (purgeEvePostgresQueue); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve purgeEvePostgresQueue's awaited sequencing and rejected-Promise behavior. */

const readQueuePurgeScope = async (
  query: QueueQuery,
  scope: {
    readonly sessionId: string;
    readonly taskIdentifier: string;
    readonly runIds: readonly string[];
  }
): Promise<Set<string>> => {
  await query`select pg_advisory_xact_lock(hashtextextended(${`eve-queue-purge:${scope.taskIdentifier}:${scope.sessionId}`}, 0))`;
  const configured = await query`select identifier from workflow.eve_queue_tasks
  where identifier = ${scope.taskIdentifier}`;
  if (configured.length === EMPTY_COUNT) {
    throw new Error("Install the queue fence before removing payloads.");
  }
  const retained = z.array(z.object({ id: z.string() })).parse(
    await query`select run_id as id from workflow.eve_queue_purge_runs
      where session_id = ${scope.sessionId} and task_identifier = ${scope.taskIdentifier}`
  );
  const known = new Set([...scope.runIds, ...retained.map((run) => run.id)]);
  const guards = await query`select resource from workflow.eve_resource_fences
  where resource in ${query([...known].map((id) => `run:${id}`))} and fenced = true for share`;
  if (guards.length !== known.size) {
    throw new Error("Fence all runs before removing queued payloads.");
  }
  return known;
};

const assertIdleQueueInventory = (inventory: QueueInventory): void => {
  if (inventory.unsupportedJobIds.length > EMPTY_COUNT) {
    throw new Error("Resolve unsupported queue messages before cleanup.");
  }
  if (
    inventory.jobs.some(
      (
        job: Readonly<{
          id: string;
          locked: boolean;
          runId: string | null;
        }>
      ) => job.locked
    )
  ) {
    throw new Error("Wait for active queue workers before cleanup.");
  }
};

const discoverQueueRuns = (
  inventory: QueueInventory,
  known: Readonly<ReadonlySet<string>>
): string[] => {
  const newIds = inventory.jobs.flatMap(
    (job: Readonly<{ id: string; locked: boolean; runId: string | null }>) => {
      if (job.runId !== null && job.runId !== "" && !known.has(job.runId)) {
        return [job.runId];
      }
      return [];
    }
  );
  return newIds;
};

const fenceDiscoveredQueueRuns = async (
  query: QueueQuery,
  runIds: Readonly<Pick<Set<string>, "add" | typeof Symbol.iterator>>,
  newRunIds: readonly string[]
): Promise<void> => {
  for (const id of newRunIds) {
    runIds.add(id);
  }
  await fenceEvePostgresResourcesInTransaction(query, {
    runIds: [...runIds],
    streamIds: [],
  });
};

const finishQueuePurge = async (
  query: QueueQuery,
  scope: {
    readonly sessionId: string;
    readonly taskIdentifier: string;
    readonly inventory: QueueInventory;
  },
  known: Readonly<ReadonlySet<string>>
): Promise<{ removedJobIds: string[]; runIds: string[] }> => {
  // Keep discovered identities durably before dropping their last queued
  // association. A lost response can then retry without losing child IDs.
  await query`insert into workflow.eve_queue_purge_runs (session_id, task_identifier, run_id)
    select ${scope.sessionId}, ${scope.taskIdentifier}, id
    from unnest(${query.array([...known])}::text[]) id on conflict do nothing`;
  return {
    removedJobIds: await removeUnlockedJobs(
      query,
      scope.inventory.jobs.map(
        (
          job: Readonly<{
            id: string;
            locked: boolean;
            runId: string | null;
          }>
        ) => job.id
      )
    ),
    runIds: [...known].toSorted(),
  };
};
const parseQueuePurgeInput = (input: {
  readonly sessionId: string;
  readonly taskIdentifier: string;
  readonly runIds: readonly string[];
}): { sessionId: string; taskIdentifier: string; runIds: string[] } => {
  const parsed = z
    .object({
      runIds: z
        .array(z.string().min(MIN_IDENTIFIER_LENGTH))
        .min(MIN_QUEUE_RUNS)
        .max(MAX_INVENTORY_SIZE),
      sessionId: z.string().min(MIN_IDENTIFIER_LENGTH),
      taskIdentifier: z.string().min(MIN_IDENTIFIER_LENGTH),
    })
    .parse(input);
  if (!parsed.runIds.includes(parsed.sessionId)) {
    throw new Error("Include the session root in the queue cleanup inventory.");
  }
  return parsed;
};

/**
 * Remove queued payloads for an authorized resource set already fenced by the
 * session coordinator. Returns newly discovered queued run IDs for the caller's
 * deletion inventory. Never force-unlocks workers or claims full session purge.
 * @param {Sql} connection PostgreSQL connection used for an atomic inventory/fence/removal transaction.
 * @param {{ sessionId: string; runIds: string[]; taskIdentifier: string; }} input Authorized session root, fenced run inventory, and configured queue task identifier.
 * @param {string} input.sessionId Session root required in the cleanup inventory.
 * @param {string[]} input.runIds Authorized run identities whose queue payloads may be removed.
 * @param {string} input.taskIdentifier Installed queue task whose fence governs these payloads.
 * @returns {Promise<{ removedJobIds: string[]; runIds: string[] }>} Removed unlocked job identities and the durably retained discovered run inventory.
 */
export const purgeEvePostgresQueue = async (
  connection: Readonly<Pick<Sql, "begin">>,
  input: {
    readonly sessionId: string;
    readonly runIds: readonly string[];
    readonly taskIdentifier: string;
  }
): Promise<{ removedJobIds: string[]; runIds: string[] }> => {
  const parsed = parseQueuePurgeInput(input);
  return await connection.begin(
    "isolation level read committed",
    async (query: QueueQuery) => {
      const known = await readQueuePurgeScope(query, parsed);
      for (
        let pass = EMPTY_COUNT;
        pass < MAX_DISCOVERY_PASSES;
        pass += NEXT_DISCOVERY_PASS
      ) {
        // oxlint-disable-next-line eslint/no-await-in-loop -- Each pass inventories writes admitted before the newly acquired fences.
        const inventory = await readEvePostgresQueueInventory(query, {
          runIds: [...known],
          taskIdentifier: parsed.taskIdentifier,
        });
        assertIdleQueueInventory(inventory);
        const newIds = discoverQueueRuns(inventory, known);
        if (newIds.length > EMPTY_COUNT) {
          // oxlint-disable-next-line eslint/no-await-in-loop -- Fence the newly discovered run set before its next inventory pass.
          await fenceDiscoveredQueueRuns(query, known, newIds);
        } else {
          // oxlint-disable-next-line eslint/no-await-in-loop -- Persist the stable inventory before removing its last queued associations.
          return await finishQueuePurge(
            query,
            {
              inventory,
              sessionId: parsed.sessionId,
              taskIdentifier: parsed.taskIdentifier,
            },
            known
          );
        }
      }
      throw new Error("Queue inventory did not stabilize; retry cleanup.");
    }
  );
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
