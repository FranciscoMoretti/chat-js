/* oxlint-disable eslint/no-await-in-loop, eslint/no-console, eslint/no-magic-numbers, import/no-nodejs-modules, import/no-relative-parent-imports, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, unicorn/no-await-expression-member, unicorn/no-null --
 * eslint/no-await-in-loop: Observe ordered runtime evidence and retirement stages without reordering or redispatch.
 * eslint/no-console: Emit local proof results and retained evidence locations.
 * eslint/no-magic-numbers: Bounded proof deadlines, fixture counts and archive permissions are explicit protocol inputs.
 * import/no-nodejs-modules: The disposable proof owns local files and child processes.
 * import/no-relative-parent-imports: Exercise the exact shared runtime/provider implementation without adding a production export.
 * typescript/explicit-function-return-type: Infer the isolated proof result from the exact runtime and database implementation.
 * typescript/prefer-readonly-parameter-types: The database and runtime SDKs own these mutable parameter types; proofs do not mutate them.
 * unicorn/no-await-expression-member: Read the asserted evidence directly without maintaining a second mutable snapshot.
 * unicorn/no-null: SQL null and child process exit state are distinct protocol values.
 */
import assert from "node:assert/strict";
import { cp, mkdtemp, symlink, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { makeWorkerUtils as candidateUtils } from "graphile-worker";
import postgres from "postgres";
import { z } from "zod";

import { makeWorkerUtils as baselineUtils } from "../../node_modules/graphile-worker/dist/index.js";

const [handoffFile, version] = z
  .tuple([z.string(), z.enum(["0.16.6", "0.18.0"])])
  .parse(process.argv.slice(2));
const handoff = z
  .object({
    databases: z.object({ lane_d: z.url() }),
    port: z.number(),
    root: z.string(),
  })
  .parse(await Bun.file(handoffFile).json());
assert.equal(
  (await Bun.file(path.join(handoff.root, "ownership")).text()).trim(),
  "chatjs-retirement-disposable-v1"
);
const url = z.string().parse(handoff.databases.lane_d);
assert.equal(new URL(url).hostname, "127.0.0.1");
assert.equal(new URL(url).pathname, "/lane_d");
assert.equal(new URL(url).username, "retirement");
assert.equal(Number(new URL(url).port), handoff.port);
const directory = await mkdtemp(path.join(tmpdir(), "chatjs-queue-recovery-"));
await cp(
  path.join(import.meta.dir, "worker.ts"),
  path.join(directory, "worker.ts")
);
const modules =
  version === "0.16.6"
    ? path.resolve(import.meta.dir, "../../node_modules")
    : path.join(import.meta.dir, "node_modules");
await symlink(modules, path.join(directory, "node_modules"));
await writeFile(path.join(directory, "package.json"), '{"type":"module"}');
const utilities = await (version === "0.16.6" ? baselineUtils : candidateUtils)(
  { connectionString: url }
);
await utilities.migrate();
const sql = postgres(url, { max: 1 });
const children: ReturnType<typeof Bun.spawn>[] = [];
const spawn = (task: string) => {
  const child = Bun.spawn(
    [
      "/opt/homebrew/opt/node@24/bin/node",
      path.join(directory, "worker.ts"),
      url,
      directory,
      task,
    ],
    {
      stderr: Bun.file(path.join(directory, `${task}-${children.length}.log`)),
      stdout: "ignore",
    }
  );
  children.push(child);
  return child;
};
const waitFile = async (name: string, count = 1) => {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const contents = await readFile(path.join(directory, name), "utf-8").catch(
      () => ""
    );
    if (contents.trim().split("\n").filter(Boolean).length >= count) {
      return contents;
    }
    await Bun.sleep(50);
  }
  throw new Error(`Missing ${name}`);
};
const startRecord = z.object({
  jobId: z.string(),
  pid: z.number(),
  workerId: z.string(),
});
const ownedWorkers = new Map<ReturnType<typeof Bun.spawn>, string>();
const recover = async (
  child: ReturnType<typeof Bun.spawn>,
  workerId: string
) => {
  assert.ok(
    child.exitCode !== null || child.signalCode !== null,
    "Refuse recovery of a live child, including SIGSTOP"
  );
  assert.equal(
    ownedWorkers.get(child),
    workerId,
    "Worker identity must belong to the dead child"
  );
  await child.exited;
  await utilities.forceUnlockWorkers([workerId]);
};
try {
  const input = { action: "original", amount: 7 };
  await utilities.addJob("slow", input, { queueName: "slow" });
  const slow = spawn("slow");
  const slowStart = startRecord.parse(
    JSON.parse(await waitFile("slow.starts"))
  );
  assert.equal(slowStart.pid, slow.pid);
  ownedWorkers.set(slow, slowStart.workerId);
  slow.kill("SIGSTOP");
  await assert.rejects(recover(slow, slowStart.workerId), /live child/u);
  await utilities.addJob("dead", input, { queueName: "dead" });
  const dead = spawn("dead");
  const deadStart = startRecord.parse(
    JSON.parse(await waitFile("dead.starts"))
  );
  assert.equal(deadStart.pid, dead.pid);
  ownedWorkers.set(dead, deadStart.workerId);
  dead.kill("SIGKILL");
  await dead.exited;
  const replacement = spawn("dead");
  await Bun.sleep(2500);
  assert.equal(
    (await readFile(path.join(directory, "dead.starts"), "utf-8"))
      .trim()
      .split("\n").length,
    1,
    "Fast scans must not unlock recent crashed jobs"
  );
  const actualScans = (
    await readFile(path.join(directory, "dead.scans"), "utf-8")
  )
    .trim()
    .split("\n")
    .filter((pid) => Number(pid) === replacement.pid).length;
  assert.ok(actualScans >= 10, "Supported scan setting must run repeatedly");
  const baseline =
    await sql`select id, locked_by from graphile_worker._private_jobs order by id`;
  await assert.rejects(recover(dead, slowStart.workerId), /identity/u);
  const unowned = Bun.spawn(["/opt/homebrew/opt/node@24/bin/node", "-e", "0"]);
  await unowned.exited;
  await assert.rejects(recover(unowned, deadStart.workerId), /identity/u);
  const started = performance.now();
  await recover(dead, deadStart.workerId);
  await waitFile("dead.starts", 2);
  const resumedMs = performance.now() - started;
  const [live] =
    await sql`select locked_by from graphile_worker._private_jobs where id=${slowStart.jobId}`;
  assert.equal(live.locked_by, slowStart.workerId);
  await assert.rejects(recover(replacement, slowStart.workerId), /live child/u);
  await writeFile(path.join(directory, "dead.release"), "go");
  assert.deepEqual(JSON.parse((await waitFile("dead.effects")).trim()), input);
  slow.kill("SIGCONT");
  await writeFile(path.join(directory, "slow.release"), "go");
  assert.deepEqual(JSON.parse((await waitFile("slow.effects")).trim()), input);
  await Bun.sleep(300);
  assert.equal(
    (await readFile(path.join(directory, "dead.effects"), "utf-8"))
      .trim()
      .split("\n").length,
    1
  );
  const report = {
    actualScans,
    baseline,
    directory,
    effects: "one original action per task; no re-enqueue",
    negativeControl:
      "SIGSTOP worker retained original lock; live recovery refused",
    noRecoveryWithinMs: 2500,
    resumedMs,
    scanIntervalMs: 100,
    version,
  };
  await writeFile(
    path.join(directory, "report.json"),
    JSON.stringify(report, null, 2)
  );
  console.log(JSON.stringify(report));
} catch (error) {
  await writeFile(path.join(directory, "failure.txt"), String(error));
  throw error;
} finally {
  for (const child of children) {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill("SIGKILL");
      await child.exited;
    }
  }
  await utilities.release();
  await sql.end();
}

/* oxlint-enable eslint/no-await-in-loop, eslint/no-console, eslint/no-magic-numbers, import/no-nodejs-modules, import/no-relative-parent-imports, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, unicorn/no-await-expression-member, unicorn/no-null */
