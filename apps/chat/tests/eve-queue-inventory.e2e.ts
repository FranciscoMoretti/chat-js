/* oxlint-disable import/no-relative-parent-imports  --
 * import/no-relative-parent-imports (#530): Keep the explicit "../lib/db/eve-queue-inventory"; "../lib/env" dependency within this package instead of introducing an alias or barrel API.
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
/* oxlint-disable eslint/func-style -- Hoisted test helpers keep scenario setup readable and stable. */
/* oxlint-disable unicorn/no-await-expression-member -- Direct awaited assertions keep each test action tied to its expectation. */
import postgres from "postgres";
import { afterAll, expect, test } from "vitest";

import { readEvePostgresQueueInventory } from "../lib/db/eve-queue-inventory";
import { env } from "../lib/env";
/* oxlint-enable import/no-relative-parent-imports */

if (!["localhost", "127.0.0.1"].includes(new URL(env.DATABASE_URL).hostname)) {
  throw new Error("Queue inventory acceptance requires local Postgres.");
}
const query = postgres(env.DATABASE_URL, { max: 1 });
const taskIdentifier = `eve-queue-fixture-${crypto.randomUUID()}`;
const jobIds: string[] = [];
/* oxlint-disable no-magic-numbers  --
 * no-magic-numbers (#517): afterAll uses 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * oxc/no-async-await (#540): afterAll sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 */
afterAll(async () => {
  if (jobIds.length > 0) {
    // Only the fixture jobs are deliberately locked by this test.
    await query`update graphile_worker._private_jobs set locked_at = null, locked_by = null
      where id::text in ${query(jobIds)}`;
    await query`select id from graphile_worker.complete_jobs(${query.array(jobIds)}::bigint[])`;
  }
  await query`delete from graphile_worker._private_tasks where identifier = ${taskIdentifier}`;
  await query.end();
});
/* oxlint-enable no-magic-numbers */

async function job(body: unknown): Promise<string> {
  const [row] = await query<
    { id: string }[]
  >`select id::text from graphile_worker.add_job(
    ${taskIdentifier},
    ${query.json({
      attempt: 1,
      data: Buffer.from(JSON.stringify(body)).toString("base64"),
      id: "fixture",
      messageId: `msg_${crypto.randomUUID()}`,
    })}::json,
    run_at := now() + interval '1 day'
  )`;
  jobIds.push(row.id);
  return row.id;
}

/* oxlint-disable id-length, typescript/prefer-readonly-parameter-types  --
 * id-length (#506): test("finds retries and queued child creation without returning input payloads") uses a; b as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 * oxc/no-async-await (#540): test("finds retries and queued child creation without returning input payloads") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * typescript/prefer-readonly-parameter-types (#565): test("finds retries and queued child creation without returning input payloads") accepts a; b; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 */
test("finds retries and queued child creation without returning input payloads", async () => {
  const root = crypto.randomUUID();
  const retry = await job({
    input: "private-marker",
    runId: root,
    stepId: "step",
  });
  const child = crypto.randomUUID();
  const childJob = await job({
    runId: child,
    runInput: {
      attributes: { $rootRunId: root },
      input: "private-marker",
    },
  });
  await job({ runId: crypto.randomUUID(), runInput: { input: "unrelated" } });
  const result = await readEvePostgresQueueInventory(query, {
    runIds: [root],
    taskIdentifier,
  });
  expect(result.jobs).toEqual(
    [
      { id: retry, locked: false, runId: root },
      { id: childJob, locked: false, runId: child },
    ].toSorted((a, b) => a.id.localeCompare(b.id))
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
/* oxlint-enable id-length, typescript/prefer-readonly-parameter-types */

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
  expect(result.jobs).toEqual([{ id: locked, locked: true, runId }]);
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
