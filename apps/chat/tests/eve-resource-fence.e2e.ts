/* oxlint-disable eslint/func-style -- Hoisted test helpers keep scenario setup readable and stable. */
/* oxlint-disable eslint/no-await-in-loop -- Integration steps and transaction fixtures intentionally run in order. */
import postgres from "postgres";
import { afterAll, expect, test } from "vitest";

import {
  fenceEvePostgresResources,
  installEvePostgresResourceFence,
} from "../lib/db/eve-resource-fence";
import { fenceEvePostgresSession } from "../lib/db/eve-session-fence";
import { env } from "../lib/env";

if (!["localhost", "127.0.0.1"].includes(new URL(env.DATABASE_URL).hostname)) {
  throw new Error("Resource fence acceptance requires local Postgres.");
}
const query = postgres(env.DATABASE_URL, { max: 4 });
const rejectedWriteCode = /^(?<code>40001|55000)$/u;
const runIds: string[] = [];
const streamIds: string[] = [];
await installEvePostgresResourceFence(query);
afterAll(async () => {
  if (streamIds.length) {
    await query`delete from workflow.workflow_stream_chunks where stream_id in ${query(streamIds)}`;
  }
  if (runIds.length) {
    await query`delete from workflow.workflow_runs where id in ${query(runIds)}`;
    await query`delete from workflow.eve_resource_fences where resource in ${query(
      [
        ...runIds.map((id) => `run:${id}`),
        ...streamIds.map((id) => `stream:${id}`),
      ]
    )}`;
  }
  await query.end();
});

async function run(status = "completed") {
  const id = crypto.randomUUID();
  runIds.push(id);
  await query`insert into workflow.workflow_runs (id, name, deployment_id, status)
    values (${id}, 'fence-fixture', 'fence-fixture', ${status})`;
  return id;
}
async function stream(runId: string | null, id = crypto.randomUUID()) {
  streamIds.push(id);
  await query`insert into workflow.workflow_stream_chunks (id, stream_id, run_id, data, eof)
    values (${crypto.randomUUID()}, ${id}, ${runId}, ${Buffer.from("payload")}, false)`;
  return id;
}

test("fence survives payload deletion and blocks replay, descendants, and every provider payload table", async () => {
  const id = await run();
  const streamId = await stream(id);
  await fenceEvePostgresResources(query, {
    runIds: [id],
    streamIds: [streamId],
  });
  await fenceEvePostgresResources(query, {
    runIds: [id],
    streamIds: [streamId],
  });
  await expect(
    query`update workflow.workflow_runs set output = '{}'::jsonb where id = ${id}`
  ).rejects.toMatchObject({ code: "55000" });
  await query`delete from workflow.workflow_stream_chunks where stream_id = ${streamId}`;
  await query`delete from workflow.workflow_runs where id = ${id}`;
  const rejected = [
    query`insert into workflow.workflow_runs (id, name, deployment_id, status) values (${id}, 'replay', 'fixture', 'pending')`,
    query`insert into workflow.workflow_events (id, run_id, type) values (${crypto.randomUUID()}, ${id}, 'step_completed')`,
    query`insert into workflow.workflow_event_slots (run_id) values (${id})`,
    query`insert into workflow.workflow_steps (step_id, run_id, step_name, status, attempt) values (${crypto.randomUUID()}, ${id}, 'late', 'completed', 1)`,
    query`insert into workflow.workflow_hooks (hook_id, run_id, token, owner_id, project_id, environment) values (${crypto.randomUUID()}, ${id}, 'late', 'fixture', 'fixture', 'test')`,
    query`insert into workflow.workflow_waits (wait_id, run_id, status) values (${crypto.randomUUID()}, ${id}, 'completed')`,
  ];
  for (const write of rejected) {
    await expect(write).rejects.toMatchObject({ code: "55000" });
  }
  await expect(stream(null, streamId)).rejects.toMatchObject({ code: "55000" });
  await expect(stream(id)).rejects.toMatchObject({ code: "55000" });
  for (const attribute of [
    "$parentRunId",
    "$rootRunId",
    "$eve.parent",
    "$eve.root",
  ]) {
    const child = crypto.randomUUID();
    runIds.push(child);
    await expect(query`insert into workflow.workflow_runs (id, name, deployment_id, status, attributes)
      values (${child}, 'late-child', 'fixture', 'pending', ${query.json({ [attribute]: id })})`).rejects.toMatchObject(
      { code: "55000" }
    );
  }
  const unrelated = await run();
  await stream(unrelated);
  expect(
    await query`select id from workflow.workflow_runs where id = ${id}`
  ).toEqual([]);
});

test("active runs and ambiguous streams roll back the entire fence", async () => {
  const active = await run("running");
  await expect(
    fenceEvePostgresResources(query, { runIds: [active], streamIds: [] })
  ).rejects.toThrow("Retire active runs");
  await stream(active);
  const terminal = await run();
  const shared = await stream(terminal);
  await stream(active, shared);
  await expect(
    fenceEvePostgresResources(query, {
      runIds: [terminal],
      streamIds: [shared],
    })
  ).rejects.toThrow("Stream ownership");
  await stream(terminal, shared);
});

test("fencing waits for admitted writers to commit before rejecting later writes", async () => {
  const id = await run();
  const entered = Promise.withResolvers<undefined>();
  const release = Promise.withResolvers<undefined>();
  const writer = query.begin(async (tx) => {
    await tx`update workflow.workflow_runs set output = '{"admitted":true}'::jsonb where id = ${id}`;
    entered.resolve(undefined);
    await release.promise;
  });
  await entered.promise;
  const fencer = postgres(env.DATABASE_URL, { max: 1 });
  const [backend] = await fencer`select pg_backend_pid() as pid`;
  const fencing = fenceEvePostgresResources(fencer, {
    runIds: [id],
    streamIds: [],
  });
  try {
    await expect
      .poll(async () => {
        const [row] =
          await query`select cardinality(pg_blocking_pids(${backend.pid})) > 0 as blocked`;
        return row.blocked;
      })
      .toBe(true);
  } finally {
    release.resolve(undefined);
    await writer;
    await fencing;
    await fencer.end();
  }
  await expect(stream(id)).rejects.toMatchObject({ code: "55000" });
  const [row] =
    await query`select output from workflow.workflow_runs where id = ${id}`;
  expect(row.output).toEqual({ admitted: true });
});

test("a repeatable-read snapshot from before the fence cannot restore payloads", async () => {
  const id = await run();
  const streamId = crypto.randomUUID();
  streamIds.push(streamId);
  const entered = Promise.withResolvers<undefined>();
  const release = Promise.withResolvers<undefined>();
  const writer = query.begin("isolation level repeatable read", async (tx) => {
    await tx`select resource from workflow.eve_resource_fences where resource = ${`run:${id}`}`;
    entered.resolve(undefined);
    await release.promise;
    await tx`insert into workflow.workflow_stream_chunks (id, stream_id, run_id, data, eof)
      values (${crypto.randomUUID()}, ${streamId}, ${id}, ${Buffer.from("late")}, false)`;
  });
  const rejected = expect(writer).rejects.toMatchObject({
    code: expect.stringMatching(rejectedWriteCode),
  });
  try {
    await entered.promise;
    await fenceEvePostgresResources(query, { runIds: [id], streamIds: [] });
  } finally {
    release.resolve(undefined);
    await rejected;
  }
  expect(
    await query`select id from workflow.workflow_stream_chunks where stream_id = ${streamId}`
  ).toEqual([]);
});

test("session fencing rolls back for an active child and succeeds after retirement", async () => {
  const root = await run();
  const child = await run("running");
  await query`update workflow.workflow_runs set attributes = ${query.json({ $parentRunId: root })} where id = ${child}`;
  await expect(fenceEvePostgresSession(query, root)).rejects.toThrow(
    "Retire all reachable runs"
  );
  const rootStream = await stream(root);
  await query`update workflow.workflow_runs set status = 'completed' where id = ${child}`;
  const result = await fenceEvePostgresSession(query, root);
  expect(result.runIds.toSorted()).toEqual([root, child].toSorted());
  expect(result.streamIds).toEqual([rootStream]);
  expect(await fenceEvePostgresSession(query, root)).toEqual(result);
  await expect(stream(child)).rejects.toMatchObject({ code: "55000" });
});

test("session fencing re-inventories a collector child committed while its fence waits", async () => {
  const collector = await run();
  const root = await run();
  await query`update workflow.workflow_runs set attributes = ${query.json({ "$eve.activity_collector": collector })} where id = ${root}`;
  const child = crypto.randomUUID();
  const childStream = crypto.randomUUID();
  runIds.push(child);
  streamIds.push(childStream);
  const entered = Promise.withResolvers<undefined>();
  const release = Promise.withResolvers<undefined>();
  const writer = query.begin(async (tx) => {
    await tx`insert into workflow.workflow_runs (id, name, deployment_id, status, attributes)
      values (${child}, 'admitted-child', 'fixture', 'completed', ${tx.json({ $parentRunId: collector })})`;
    await tx`insert into workflow.workflow_stream_chunks (id, stream_id, run_id, data, eof)
      values (${crypto.randomUUID()}, ${childStream}, ${child}, ${Buffer.from("admitted")}, false)`;
    entered.resolve(undefined);
    await release.promise;
  });
  await entered.promise;
  const fencer = postgres(env.DATABASE_URL, { max: 1 });
  const [backend] = await fencer`select pg_backend_pid() as pid`;
  const fencing = fenceEvePostgresSession(fencer, root);
  try {
    try {
      await expect
        .poll(async () => {
          const [row] =
            await query`select cardinality(pg_blocking_pids(${backend.pid})) > 0 as blocked`;
          return row.blocked;
        })
        .toBe(true);
    } finally {
      release.resolve(undefined);
      await writer;
    }
    const result = await fencing;
    expect(result.runIds.toSorted()).toEqual(
      [root, collector, child].toSorted()
    );
    expect(result.streamIds).toEqual([childStream]);
    await expect(stream(child)).rejects.toMatchObject({ code: "55000" });
  } finally {
    await Promise.allSettled([writer, fencing]);
    await fencer.end();
  }
});
