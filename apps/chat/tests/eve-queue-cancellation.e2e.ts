/* oxlint-disable import/no-nodejs-modules, import/no-relative-parent-imports  --
 * import/no-nodejs-modules (#529): This test harness requires import { createServer } from "node:http";; its Node runtime boundary deliberately permits these built-ins.
 * import/no-relative-parent-imports (#530): Keep the explicit "../lib/env" dependency within this package instead of introducing an alias or barrel API.
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
/* oxlint-disable eslint/no-promise-executor-return -- These Promise executors directly register callback APIs whose return values are ignored. */
/* oxlint-disable promise/avoid-new -- These fixtures adapt callback, timer, stream, or browser event APIs into awaited Promises. */
import { createServer } from "node:http";

import { createWorld } from "@workflow/world-postgres";
import { Pool } from "pg";
import { expect, test, vi } from "vitest";

import { env } from "../lib/env";
/* oxlint-enable import/no-nodejs-modules, import/no-relative-parent-imports */

if (!["127.0.0.1", "localhost"].includes(new URL(env.DATABASE_URL).hostname)) {
  throw new Error("Queue cancellation acceptance requires local Postgres.");
}

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, no-undefined, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, typescript/strict-void-return  --
 * max-lines-per-function (#510): test("distinct deliveries wake a pending workflow while exact duplicates remain dedup keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): test("distinct deliveries wake a pending workflow while exact duplicates remain dedup keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("distinct deliveries wake a pending workflow while exact duplicates remain dedup uses 1, 200, 0, 2, 3, 15_000 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * no-undefined (#519): test("distinct deliveries wake a pending workflow while exact duplicates remain dedup uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * oxc/no-async-await (#540): test("distinct deliveries wake a pending workflow while exact duplicates remain dedup sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * oxc/no-optional-chaining (#542): test("distinct deliveries wake a pending workflow while exact duplicates remain dedup handles optional queue.close?.() without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
 * typescript/prefer-readonly-parameter-types (#565): test("distinct deliveries wake a pending workflow while exact duplicates remain dedup accepts request; response; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): test("distinct deliveries wake a pending workflow while exact duplicates remain dedup intentionally keeps the existing falsy-value behavior of address; distinguishing empty, zero, and absent states requires a domain behavior decision.
 * typescript/strict-void-return (#611): test("distinct deliveries wake a pending workflow while exact duplicates remain dedup's void callback contract discards its result; changing the callback API or operation order solely to hide the return value is unnecessary.
 */
test("distinct deliveries wake a pending workflow while exact duplicates remain deduplicated", async () => {
  const release = Promise.withResolvers<undefined>();
  const calls: string[] = [];
  // oxlint-disable-next-line typescript/no-misused-promises -- This controlled HTTP fixture awaits a resolve-only gate to hold the first delivery open; no rejected task escapes the handler.
  const server = createServer(async (request, response) => {
    const id = request.headers["x-vqs-message-id"];
    calls.push(String(id));
    if (calls.length === 1) {
      await release.promise;
    }
    response.writeHead(200).end();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Missing address");
  }
  vi.stubEnv("WORKFLOW_LOCAL_BASE_URL", `http://127.0.0.1:${address.port}`);
  const pool = new Pool({ connectionString: env.DATABASE_URL, max: 4 });
  const jobPrefix = `eve_cancel_${crypto.randomUUID()}_`;
  const queue = createWorld({
    applicationManagedShutdown: true,
    jobPrefix,
    pool,
    queueConcurrency: 4,
  });
  const runId = `wrun_${crypto.randomUUID()}`;
  const pendingJobs = async (): Promise<number> => {
    const result = await pool.query<{ count: string }>(
      "select count(*) from graphile_worker._private_jobs j join graphile_worker._private_tasks t on t.id=j.task_id where t.identifier=$1",
      [`${jobPrefix}flows`]
    );
    return Number(result.rows[0].count);
  };
  try {
    await queue.queue("__wkf_workflow_fixture", { runId });
    await expect.poll(() => calls.length).toBe(1);
    await queue.queue("__wkf_workflow_fixture", { runId });
    await expect.poll(() => calls.length).toBe(2);
    expect(calls).toHaveLength(2);
    release.resolve(undefined);
    await expect.poll(pendingJobs).toBe(0);
    const idempotencyKey = crypto.randomUUID();
    await Promise.all([
      queue.queue("__wkf_workflow_fixture", { runId }, { idempotencyKey }),
      queue.queue("__wkf_workflow_fixture", { runId }, { idempotencyKey }),
    ]);
    await expect.poll(pendingJobs).toBe(0);
    expect(calls).toHaveLength(3);
    await queue.queue("__wkf_workflow_fixture", { runId }, { idempotencyKey });
    await expect.poll(pendingJobs).toBe(0);
    expect(calls).toHaveLength(3);
  } finally {
    release.resolve(undefined);
    server.closeAllConnections();
    await queue.close?.();
    await pool.query(
      "delete from graphile_worker._private_jobs where task_id in (select id from graphile_worker._private_tasks where identifier=$1)",
      [`${jobPrefix}flows`]
    );
    await pool.query(
      "delete from graphile_worker._private_tasks where identifier=$1",
      [`${jobPrefix}flows`]
    );
    await pool.end();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    vi.unstubAllEnvs();
  }
}, 15_000);
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, no-undefined, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, typescript/strict-void-return */
