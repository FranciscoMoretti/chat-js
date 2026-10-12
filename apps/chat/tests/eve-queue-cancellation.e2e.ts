import { createServer } from "node:http";
import type { ServerResponse } from "node:http";

import { createWorld } from "@workflow/world-postgres";
import { Pool } from "pg";
import { expect, test, vi } from "vitest";

import { env } from "../lib/env";

if (!["127.0.0.1", "localhost"].includes(new URL(env.DATABASE_URL).hostname)) {
  throw new Error("Queue cancellation acceptance requires local Postgres.");
}

test("distinct deliveries wake a pending workflow while exact duplicates remain deduplicated", async () => {
  const release = Promise.withResolvers<undefined>();
  const calls: string[] = [];

  const server = createServer(
    (
      request: Readonly<{
        headers: Readonly<
          Record<string, string | readonly string[] | undefined>
        >;
      }>,
      response: ServerResponse
    ) => {
      void (async (): Promise<void> => {
        try {
          const id = request.headers["x-vqs-message-id"];
          calls.push(String(id));
          if (calls.length === 1) {
            await release.promise;
          }
          response.writeHead(200).end();
        } catch (error) {
          if (error instanceof Error) {
            response.destroy(error);
          } else {
            response.destroy(new Error(String(error)));
          }
        }
      })();
    }
  );
  // oxlint-disable-next-line promise/avoid-new -- Adapt the callback-only server/stream API while preserving synchronous setup, completion, and rejection semantics.
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (address === null || typeof address === "string") {
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
    // oxlint-disable-next-line unicorn/no-useless-undefined -- The Promise<undefined> resolver requires its explicit completion value.
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
    // oxlint-disable-next-line unicorn/no-useless-undefined -- The Promise<undefined> resolver requires its explicit completion value.
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
    // oxlint-disable-next-line promise/avoid-new -- Adapt the callback-only server/stream API while preserving synchronous setup, completion, and rejection semantics.
    await new Promise<void>((resolve) => {
      server.close(() => {
        resolve();
      });
    });
    vi.unstubAllEnvs();
  }
}, 15_000);
