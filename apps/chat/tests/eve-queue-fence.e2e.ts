/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "@/lib/eve/lifecycle/postgres/eve-queue-fence"; "@/lib/eve/lifecycle/postgres/eve-queue-purge"; "@/lib/eve/lifecycle/postgres/eve-resource-fence"; "../lib/env" dependency within this package instead of introducing an alias or barrel API.
 */
/* oxlint-disable eslint/func-style -- Hoisted test helpers keep scenario setup readable and stable. */
/* oxlint-disable eslint/no-await-in-loop -- Integration steps and transaction fixtures intentionally run in order. */
import postgres from "postgres";
/* oxlint-disable eslint/sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { afterAll, expect, test } from "vitest";
/* oxlint-enable eslint/sort-imports */

import { installEvePostgresQueueFence } from "@/lib/eve/lifecycle/postgres/eve-queue-fence";
import { purgeEvePostgresQueue } from "@/lib/eve/lifecycle/postgres/eve-queue-purge";
/* oxlint-disable eslint/sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  fenceEvePostgresResources,
  installEvePostgresResourceFence,
} from "@/lib/eve/lifecycle/postgres/eve-resource-fence";
/* oxlint-enable eslint/sort-imports */

import { env } from "../lib/env";
/* oxlint-enable import/no-relative-parent-imports */

if (!["localhost", "127.0.0.1"].includes(new URL(env.DATABASE_URL).hostname)) {
  throw new Error("Queue fence acceptance requires local Postgres.");
}
const query = postgres(env.DATABASE_URL, { max: 1 });
const task = `eve-queue-fence-${crypto.randomUUID()}`;
const ids: string[] = [];
const runIds: string[] = [];
// oxlint-disable-next-line node/no-top-level-await -- This Bun database suite installs resource fencing before registering queue scenarios.
await installEvePostgresResourceFence(query);
// oxlint-disable-next-line node/no-top-level-await -- This Bun database suite installs queue fencing before registering queue scenarios.
await installEvePostgresQueueFence(query, task);
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve afterAll's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): afterAll uses 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
afterAll(async () => {
  if (ids.length > 0) {
    await query`update graphile_worker._private_jobs set locked_at = null, locked_by = null where id::text in ${query(ids)}`;
    await query`select id from graphile_worker.complete_jobs(${query.array(ids)}::bigint[])`;
  }
  await query`delete from graphile_worker._private_tasks where identifier = ${task}`;
  await query`delete from workflow.eve_queue_tasks where identifier = ${task}`;
  await query`delete from workflow.eve_queue_purge_runs where task_identifier = ${task}`;
  if (runIds.length > 0) {
    await query`delete from workflow.eve_resource_fences where resource in ${query(runIds.map((id) => `run:${id}`))}`;
  }
  await query.end();
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable no-magic-numbers */

function runId(): string {
  const id = crypto.randomUUID();
  runIds.push(id);
  return id;
}

/* oxlint-disable typescript/explicit-function-return-type --
 * typescript/explicit-function-return-type (#560): Keep envelope's return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 */
function envelope(body: unknown) {
  return {
    attempt: 1,
    data: Buffer.from(JSON.stringify(body)).toString("base64"),
    id: "fixture",
    messageId: `msg_${crypto.randomUUID()}`,
  };
}
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve job's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable typescript/explicit-function-return-type */
async function job(body: unknown): Promise<string> {
  const [row] = await query<
    { id: string }[]
  >`select id::text from graphile_worker.add_job(
    ${task}, ${query.json(envelope(body))}::json, run_at := now() + interval '1 day')`;
  ids.push(row.id);
  return row.id;
}
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
test("queue fencing rejects retries and resilient child creation for fenced roots", async () => {
  const root = runId();
  await fenceEvePostgresResources(query, { runIds: [root], streamIds: [] });
  await expect(job({ runId: root })).rejects.toMatchObject({ code: "55000" });
  for (const key of [
    "$parentRunId",
    "$rootRunId",
    "$eve.parent",
    "$eve.root",
  ]) {
    await expect(
      job({ runId: runId(), runInput: { attributes: { [key]: root } } })
    ).rejects.toMatchObject({ code: "55000" });
  }
  await job({ runId: runId() });
  await job({ __healthCheck: true, correlationId: "fixture" });
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable no-magic-numbers, unicorn/max-nested-calls --
 * no-magic-numbers (#517): test("workers can release locks after fencing but cannot replace or move a protected  uses 0, -1, 1 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * unicorn/max-nested-calls (#568): test("workers can release locks after fencing but cannot replace or move a protected  keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 */
test("workers can release locks after fencing but cannot replace or move a protected payload", async () => {
  const root = runId();
  const id = await job({ runId: root });
  await query`update graphile_worker._private_jobs set locked_at = now(), locked_by = 'fixture-only' where id::text = ${id}`;
  await fenceEvePostgresResources(query, { runIds: [root], streamIds: [] });
  await query`update graphile_worker._private_jobs set locked_at = null, locked_by = null, payload = payload where id::text = ${id}`;
  const [stored] = await query<
    { payload: string }[]
  >`select payload::text as payload from graphile_worker._private_jobs where id::text = ${id}`;
  // JSONB equality would discard this duplicate field and mistake changed bytes
  // for unchanged bookkeeping. The protected envelope must remain untouched.
  const duplicateField = `${stored.payload.trimEnd().slice(0, -1)},"attempt":1}`;
  await expect(
    query`update graphile_worker._private_jobs set payload = ${duplicateField}::text::json where id::text = ${id}`
  ).rejects.toMatchObject({ code: "55000" });
  await expect(
    query`update graphile_worker._private_jobs set payload = ${query.json(envelope({ runId: runId() }))}::json where id::text = ${id}`
  ).rejects.toMatchObject({ code: "55000" });
  expect(
    await query`select id from graphile_worker.complete_jobs(${query.array([id])}::bigint[])`
  ).toHaveLength(1);
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers, unicorn/max-nested-calls */

test("unsupported queue messages fail closed for registered tasks", async () => {
  await expect(job({ unexpected: true })).rejects.toMatchObject({
    code: "22023",
  });
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable max-statements, no-magic-numbers --
 * max-statements (#512): test("queue purge removes queued descendants and retains their IDs across retries") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("queue purge removes queued descendants and retains their IDs across retries") uses 1 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
test("queue purge removes queued descendants and retains their IDs across retries", async () => {
  const root = runId();
  const child = runId();
  const grandchild = runId();
  const rootJob = await job({ runId: root });
  const childJob = await job({
    runId: child,
    runInput: { attributes: { $parentRunId: root } },
  });
  const grandchildJob = await job({
    runId: grandchild,
    runInput: { attributes: { $parentRunId: child } },
  });
  const unrelated = await job({ runId: runId() });
  const input = { runIds: [root], sessionId: root, taskIdentifier: task };
  await expect(purgeEvePostgresQueue(query, input)).rejects.toThrow(
    "Fence all runs"
  );
  await fenceEvePostgresResources(query, { runIds: [root], streamIds: [] });
  const result = await purgeEvePostgresQueue(query, input);
  expect(result.removedJobIds).toEqual(
    [rootJob, childJob, grandchildJob].toSorted()
  );
  expect(result.runIds).toEqual([root, child, grandchild].toSorted());
  expect(
    await query`select id from graphile_worker._private_jobs where id::text in ${query([rootJob, childJob, grandchildJob])}`
  ).toEqual([]);
  expect(
    await query`select id from graphile_worker._private_jobs where id::text = ${unrelated}`
  ).toHaveLength(1);
  expect(await purgeEvePostgresQueue(query, input)).toEqual({
    removedJobIds: [],
    runIds: result.runIds,
  });
  await expect(job({ runId: grandchild })).rejects.toMatchObject({
    code: "55000",
  });
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-statements, no-magic-numbers */

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): test("queue purge refuses even an old worker lock and succeeds after explicit release uses 1 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
test("queue purge refuses even an old worker lock and succeeds after explicit release", async () => {
  const root = runId();
  const id = await job({ runId: root });
  await query`update graphile_worker._private_jobs set locked_at = now() - interval '5 hours', locked_by = 'fixture-only' where id::text = ${id}`;
  await fenceEvePostgresResources(query, { runIds: [root], streamIds: [] });
  const input = { runIds: [root], sessionId: root, taskIdentifier: task };
  await expect(purgeEvePostgresQueue(query, input)).rejects.toThrow(
    "active queue workers"
  );
  expect(
    await query`select id from graphile_worker._private_jobs where id::text = ${id}`
  ).toHaveLength(1);
  await query`update graphile_worker._private_jobs set locked_at = null, locked_by = null where id::text = ${id}`;
  const purgeResult = await purgeEvePostgresQueue(query, input);
  expect(purgeResult.removedJobIds).toEqual([id]);
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable no-magic-numbers */
