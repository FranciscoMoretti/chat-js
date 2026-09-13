import postgres from "postgres";
import { afterAll, expect, test } from "vitest";

import { readEvePostgresQueueInventory } from "../lib/db/eve-queue-inventory";
import { env } from "../lib/env";

if (!["localhost", "127.0.0.1"].includes(new URL(env.DATABASE_URL).hostname)) {
  throw new Error("Queue inventory acceptance requires local Postgres.");
}
const query = postgres(env.DATABASE_URL, { max: 1 });
const taskIdentifier = `eve-queue-fixture-${crypto.randomUUID()}`;
const jobIds: string[] = [];
afterAll(async () => {
  if (jobIds.length) {
    // Only the fixture jobs are deliberately locked by this test.
    await query`update graphile_worker._private_jobs set locked_at = null, locked_by = null
      where id::text in ${query(jobIds)}`;
    await query`select id from graphile_worker.complete_jobs(${query.array(jobIds)}::bigint[])`;
  }
  await query`delete from graphile_worker._private_tasks where identifier = ${taskIdentifier}`;
  await query.end();
});

async function job(body: unknown) {
  const [row] = await query`select id::text from graphile_worker.add_job(
    ${taskIdentifier},
    ${query.json({
      attempt: 1,
      messageId: `msg_${crypto.randomUUID()}`,
      id: "fixture",
      data: Buffer.from(JSON.stringify(body)).toString("base64"),
    })}::json,
    run_at := now() + interval '1 day'
  )`;
  jobIds.push(row.id);
  return row.id;
}

test("finds retries and queued child creation without returning input payloads", async () => {
  const root = crypto.randomUUID();
  const retry = await job({
    runId: root,
    stepId: "step",
    input: "private-marker",
  });
  const child = crypto.randomUUID();
  const childJob = await job({
    runId: child,
    runInput: {
      input: "private-marker",
      attributes: { $rootRunId: root },
    },
  });
  await job({ runId: crypto.randomUUID(), runInput: { input: "unrelated" } });
  const result = await readEvePostgresQueueInventory(query, {
    runIds: [root],
    taskIdentifier,
  });
  expect(result.jobs).toEqual(
    [
      { id: retry, runId: root, locked: false },
      { id: childJob, runId: child, locked: false },
    ].sort((a, b) => a.id.localeCompare(b.id))
  );
  expect(result.unsupportedJobIds).toEqual([]);
  expect(JSON.stringify(result)).not.toContain("private-marker");
  expect(
    (
      await readEvePostgresQueueInventory(query, {
        runIds: [root],
        taskIdentifier: "other-fixture",
      })
    ).jobs
  ).toEqual([]);
});

test("reports worker locks and unsupported messages; ignores ordinary health probes", async () => {
  const runId = crypto.randomUUID();
  const locked = await job({ runId });
  await query`update graphile_worker._private_jobs set locked_at = now(), locked_by = 'fixture-only'
    where id::text = ${locked}`;
  const unsupported = await job({ unexpected: true });
  await job({ __healthCheck: true, correlationId: "fixture" });
  const result = await readEvePostgresQueueInventory(query, {
    runIds: [runId],
    taskIdentifier,
  });
  expect(result.jobs).toEqual([{ id: locked, runId, locked: true }]);
  expect(result.unsupportedJobIds).toEqual([unsupported]);
});

test("missing envelopes are reported and invalid encoding cannot silently disappear", async () => {
  const runId = crypto.randomUUID();
  const id = await job({ runId });
  await query`update graphile_worker._private_jobs set payload = '{}'::json where id::text = ${id}`;
  const result = await readEvePostgresQueueInventory(query, {
    runIds: [runId],
    taskIdentifier,
  });
  expect(result.unsupportedJobIds).toContain(id);
  await query`update graphile_worker._private_jobs set payload = '{"data":"###"}'::json where id::text = ${id}`;
  await expect(
    readEvePostgresQueueInventory(query, { runIds: [runId], taskIdentifier })
  ).rejects.toThrow();
});
