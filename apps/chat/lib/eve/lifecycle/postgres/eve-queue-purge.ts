import type { Sql, TransactionSql } from "postgres";
import { z } from "zod";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { readEvePostgresQueueInventory } from "./eve-queue-inventory";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { fenceEvePostgresResourcesInTransaction } from "./eve-resource-fence";
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve removeUnlockedJobs's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable sort-imports */

/* oxlint-disable no-magic-numbers -- * no-magic-numbers (#517): removeUnlockedJobs uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions. */
const removeUnlockedJobs = async (
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Execute metadata reads through the native Postgres tag and interpolation overloads; preserving those callable signatures retains SDK mutable members and the rule finding.
  query: TransactionSql,
  jobIds: readonly string[]
): Promise<string[]> => {
  if (jobIds.length === 0) {
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
  const removed =
    // oxlint-disable-next-line no-ternary -- Keep removed as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
    locked.length > 0
      ? z
          .array(z.object({ id: z.string() }))
          .parse(
            await query`select id::text from graphile_worker.complete_jobs(${query.array(locked.map((job) => job.id))}::bigint[])`
          )
      : [];
  if (removed.length !== locked.length) {
    throw new Error("Queue cleanup did not remove every locked job.");
  }
  return removed.map((job) => job.id).toSorted();
};
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (purgeEvePostgresQueue); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve purgeEvePostgresQueue's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers */

/* oxlint-disable max-lines-per-function, max-statements, no-continue, no-magic-numbers, typescript/strict-boolean-expressions -- * max-lines-per-function (#510): purgeEvePostgresQueue keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): purgeEvePostgresQueue keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-continue (#515): purgeEvePostgresQueue skips inapplicable loop entries explicitly; moving the remaining work into nested branches changes the control-flow boundary.
 * no-magic-numbers (#517): purgeEvePostgresQueue uses 1, 10_000, 0, 100 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/strict-boolean-expressions (#610): purgeEvePostgresQueue intentionally keeps the existing falsy-value behavior of job.runId; distinguishing empty, zero, and absent states requires a domain behavior decision. */
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
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Open the native Postgres transaction with connection.begin; preserve its overloaded transaction callback and connection lifecycle contract.
  connection: Sql,
  input: {
    readonly sessionId: string;
    readonly runIds: readonly string[];
    readonly taskIdentifier: string;
  }
): Promise<{ removedJobIds: string[]; runIds: string[] }> => {
  const parsed = z
    .object({
      runIds: z.array(z.string().min(1)).min(1).max(10_000),
      sessionId: z.string().min(1),
      taskIdentifier: z.string().min(1),
    })
    .parse(input);
  if (!parsed.runIds.includes(parsed.sessionId)) {
    throw new Error("Include the session root in the queue cleanup inventory.");
  }
  return await connection.begin(
    "isolation level read committed",
    async (
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- This native transaction executes database writes and retains the Postgres tagged-query and interpolation overloads.
      query
    ) => {
      await query`select pg_advisory_xact_lock(hashtextextended(${`eve-queue-purge:${parsed.taskIdentifier}:${parsed.sessionId}`}, 0))`;
      const configured =
        await query`select identifier from workflow.eve_queue_tasks
      where identifier = ${parsed.taskIdentifier}`;
      if (configured.length === 0) {
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
      for (let pass = 0; pass < 100; pass += 1) {
        // oxlint-disable-next-line eslint/no-await-in-loop -- Process one resource at a time so fencing and cleanup stay ordered and bounded.
        const inventory = await readEvePostgresQueueInventory(query, {
          runIds: [...known],
          taskIdentifier: parsed.taskIdentifier,
        });
        if (inventory.unsupportedJobIds.length > 0) {
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
        const newIds = inventory.jobs.flatMap(
          (
            job: Readonly<{ id: string; locked: boolean; runId: string | null }>
          ) => {
            if (job.runId && !known.has(job.runId)) {
              return [job.runId];
            }
            return [];
          }
        );
        if (newIds.length > 0) {
          for (const id of newIds) {
            known.add(id);
          }
          // oxlint-disable-next-line eslint/no-await-in-loop -- Process one resource at a time so fencing and cleanup stay ordered and bounded.
          await fenceEvePostgresResourcesInTransaction(query, {
            runIds: [...known],
            streamIds: [],
          });
          continue;
        }
        // Keep discovered identities durably before dropping their last queued
        // association. A lost response can then retry without losing child IDs.
        // oxlint-disable-next-line eslint/no-await-in-loop -- Process one resource at a time so fencing and cleanup stay ordered and bounded.
        await query`insert into workflow.eve_queue_purge_runs (session_id, task_identifier, run_id)
          select ${parsed.sessionId}, ${parsed.taskIdentifier}, id
          from unnest(${query.array([...known])}::text[]) id on conflict do nothing`;
        return {
          // oxlint-disable-next-line eslint/no-await-in-loop -- Process one resource at a time so fencing and cleanup stay ordered and bounded.
          removedJobIds: await removeUnlockedJobs(
            query,
            inventory.jobs.map(
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
      }
      throw new Error("Queue inventory did not stabilize; retry cleanup.");
    }
  );
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-lines-per-function, max-statements, no-continue, no-magic-numbers, typescript/strict-boolean-expressions */
