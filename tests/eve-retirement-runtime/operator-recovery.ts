import assert from "node:assert/strict";
import path from "node:path";

import { makeWorkerUtils } from "graphile-worker";
import postgres from "postgres";
import { z } from "zod";

const recoverDeadPostgresFixture = async (
  directory: string,
  generation: number
): Promise<void> => {
  const proof = z
    .object({ database: z.literal("lane_d"), handoff: z.string() })
    .parse(
      await Bun.file(path.join(directory, "postgres-provenance.json")).json()
    );
  const handoff = z
    .object({
      databases: z.object({ lane_d: z.url() }),
      port: z.number(),
      root: z.string(),
    })
    .parse(await Bun.file(proof.handoff).json());
  const ownership = await Bun.file(path.join(handoff.root, "ownership")).text();
  assert.equal(ownership.trim(), "chatjs-retirement-disposable-v1");
  const url = new URL(handoff.databases.lane_d);
  assert.equal(url.hostname, "127.0.0.1");
  assert.equal(url.pathname, "/lane_d");
  assert.equal(url.username, "retirement");
  assert.equal(Number(url.port), handoff.port);
  const crash = z
    .object({
      phase: z.literal("cli-exited"),
      serverPid: z.number().int().positive(),
    })
    .parse(
      await Bun.file(path.join(directory, `crash-${generation}.json`)).json()
    );
  const processGroups = Bun.spawn(["ps", "-axo", "pgid="], { stdout: "pipe" });
  const groups = await new Response(processGroups.stdout).text();
  const successExitCode = 0;
  assert.equal(await processGroups.exited, successExitCode);
  assert.equal(
    groups.split(/\s+/u).some((value) => Number(value) === crash.serverPid),
    false
  );
  const connection = postgres(url.href, { max: 1 });
  const noConnections = 0;
  try {
    const active = await connection<
      { count: number }[]
    >`select count(*)::int as count from pg_stat_activity where datname = current_database() and pid <> pg_backend_pid() and backend_type = 'client backend'`;
    assert.equal(
      active[successExitCode]?.count,
      noConnections,
      "Refuse operator recovery while another process owns a database connection"
    );
    const rows = await connection<
      { worker: string }[]
    >`select distinct locked_by as worker from graphile_worker._private_jobs where locked_by is not null`;
    assert.ok(rows.length > noConnections, "Expected an orphaned job lock");
    const workers = rows.map((row: Readonly<{ worker: string }>) => row.worker);
    const utilities = await makeWorkerUtils({ connectionString: url.href });
    try {
      await utilities.forceUnlockWorkers(workers);
    } finally {
      await utilities.release();
    }
    await Bun.write(
      path.join(directory, `operator-recovery-${generation}.json`),
      JSON.stringify({
        crash,
        operation: "graphile-worker.forceUnlockWorkers",
        workers,
      })
    );
  } finally {
    await connection.end();
  }
};
export { recoverDeadPostgresFixture };
