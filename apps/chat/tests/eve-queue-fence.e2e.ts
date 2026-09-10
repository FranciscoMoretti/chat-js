import postgres from "postgres";
import { afterAll, expect, test } from "vitest";
import { installEvePostgresQueueFence } from "../lib/db/eve-queue-fence";
import { purgeEvePostgresQueue } from "../lib/db/eve-queue-purge";
import {
  fenceEvePostgresResources,
  installEvePostgresResourceFence,
} from "../lib/db/eve-resource-fence";
import { env } from "../lib/env";

if (!["localhost", "127.0.0.1"].includes(new URL(env.DATABASE_URL).hostname)) {
  throw new Error("Queue fence acceptance requires local Postgres.");
}
const query = postgres(env.DATABASE_URL, { max: 1 });
const task = `eve-queue-fence-${crypto.randomUUID()}`;
const ids: string[] = [];
const runIds: string[] = [];
await installEvePostgresResourceFence(query);
await installEvePostgresQueueFence(query, task);
afterAll(async () => {
  if (ids.length) {
    await query`update graphile_worker._private_jobs set locked_at = null, locked_by = null where id::text in ${query(ids)}`;
    await query`select id from graphile_worker.complete_jobs(${query.array(ids)}::bigint[])`;
  }
  await query`delete from graphile_worker._private_tasks where identifier = ${task}`;
  await query`delete from workflow.eve_queue_tasks where identifier = ${task}`;
  await query`delete from workflow.eve_queue_purge_runs where task_identifier = ${task}`;
  if (runIds.length) {
    await query`delete from workflow.eve_resource_fences where resource in ${query(runIds.map((id) => `run:${id}`))}`;
  }
  await query.end();
});
function runId() {
  const id = crypto.randomUUID();
  runIds.push(id);
  return id;
}
function envelope(body: unknown) {
  return {
    attempt: 1,
    messageId: `msg_${crypto.randomUUID()}`,
    id: "fixture",
    data: Buffer.from(JSON.stringify(body)).toString("base64"),
  };
}
async function job(body: unknown) {
  const [row] = await query`select id::text from graphile_worker.add_job(
    ${task}, ${query.json(envelope(body))}::json, run_at := now() + interval '1 day')`;
  ids.push(row.id);
  return row.id;
}

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

test("workers can release locks after fencing but cannot replace or move a protected payload", async () => {
  const root = runId();
  const id = await job({ runId: root });
  await query`update graphile_worker._private_jobs set locked_at = now(), locked_by = 'fixture-only' where id::text = ${id}`;
  await fenceEvePostgresResources(query, { runIds: [root], streamIds: [] });
  await query`update graphile_worker._private_jobs set locked_at = null, locked_by = null, payload = payload where id::text = ${id}`;
  const [stored] =
    await query`select payload::text as payload from graphile_worker._private_jobs where id::text = ${id}`;
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

test("unsupported queue messages fail closed for registered tasks", async () => {
  await expect(job({ unexpected: true })).rejects.toMatchObject({
    code: "22023",
  });
});

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
  const input = { sessionId: root, runIds: [root], taskIdentifier: task };
  await expect(purgeEvePostgresQueue(query, input)).rejects.toThrow(
    "Fence all runs"
  );
  await fenceEvePostgresResources(query, { runIds: [root], streamIds: [] });
  const result = await purgeEvePostgresQueue(query, input);
  expect(result.removedJobIds).toEqual(
    [rootJob, childJob, grandchildJob].sort()
  );
  expect(result.runIds).toEqual([root, child, grandchild].sort());
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

test("queue purge refuses even an old worker lock and succeeds after explicit release", async () => {
  const root = runId();
  const id = await job({ runId: root });
  await query`update graphile_worker._private_jobs set locked_at = now() - interval '5 hours', locked_by = 'fixture-only' where id::text = ${id}`;
  await fenceEvePostgresResources(query, { runIds: [root], streamIds: [] });
  const input = { sessionId: root, runIds: [root], taskIdentifier: task };
  await expect(purgeEvePostgresQueue(query, input)).rejects.toThrow(
    "active queue workers"
  );
  expect(
    await query`select id from graphile_worker._private_jobs where id::text = ${id}`
  ).toHaveLength(1);
  await query`update graphile_worker._private_jobs set locked_at = null, locked_by = null where id::text = ${id}`;
  expect((await purgeEvePostgresQueue(query, input)).removedJobIds).toEqual([
    id,
  ]);
});
