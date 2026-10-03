/* oxlint-disable import/no-nodejs-modules -- the node:child_process import: This command runs in Node/Bun and requires the imported filesystem/process/path API. */
import { execFileSync, spawn } from "node:child_process";
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-disable import/no-nodejs-modules -- the node:timers/promises import: This command runs in Node/Bun and requires the imported filesystem/process/path API. */
import { setTimeout as delay } from "node:timers/promises";
/* oxlint-enable import/no-nodejs-modules */

import { checkHealth } from "./dev-health";
import { shouldRestartAfterReadinessFailures } from "./dev-recovery";

/* oxlint-disable node/no-process-env -- origin: This process boundary owns environment loading/forwarding; consumers receive the resulting validated configuration. */
const origin = process.env.APP_URL;
/* oxlint-enable node/no-process-env */
/* oxlint-disable typescript/strict-boolean-expressions -- dev-supervisor.ts: The existing predicate intentionally treats absent/empty/false values together; separating them requires a domain-state decision. */
if (!origin || !["localhost", "127.0.0.1"].includes(new URL(origin).hostname)) {
  throw new Error("Run through bun dev:supervise with a local worktree URL.");
}
/* oxlint-enable typescript/strict-boolean-expressions */

let stopping = false;
/* oxlint-disable eslint/init-declarations -- child: Assignment occurs only after branch-specific validation; eager initialization would hide definite-assignment guarantees. */
let child: ReturnType<typeof spawn> | undefined;
/* oxlint-enable eslint/init-declarations */
/* oxlint-disable typescript/promise-function-async -- sleep: Keep synchronous validation/throws and the original promise identity; adding async changes those observable boundaries. */
const sleep = (ms: number): Promise<void> => delay(ms);
/* oxlint-enable typescript/promise-function-async */
// Eve's development runtime detaches its child process. Track descendants
// while the launcher is alive so shutdown also cleans up detached workers.
let descendants = new Map<number, string>();
/* oxlint-disable eslint/max-statements -- trackChildren: This ordered transaction/startup operation shares local validation and cleanup; extraction requires lifecycle boundaries. */
/* oxlint-disable node/no-sync -- trackChildren: Startup/discovery consumes this synchronous OS/filesystem API before dependent commands run. */
/* oxlint-disable typescript/strict-boolean-expressions -- trackChildren: The existing predicate intentionally treats absent/empty/false values together; separating them requires a domain-state decision. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- trackChildren: The database/OS/SDK object retains its declared mutable API; deep-readonly conversion requires an ownership migration. */
const trackChildren = (): void => {
  if (!child?.pid) {
    return;
  }
  const rows = execFileSync("ps", ["-axo", "pid=,ppid=,lstart="], {
    encoding: "utf-8",
  })
    .trim()
    .split("\n")
    .map((line) => {
      const [pid, parent, ...started] = line.trim().split(/\s+/u);
      return {
        parent: Number(parent),
        pid: Number(pid),
        started: started.join(" "),
      };
    });
  const alive = new Map(rows.map((row) => [row.pid, row.started]));
  for (const [pid, started] of descendants) {
    if (alive.get(pid) !== started) {
      descendants.delete(pid);
    }
  }
  const found = new Set([child.pid]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const { pid, parent } of rows) {
      if (pid && parent && found.has(parent) && !found.has(pid)) {
        found.add(pid);
        changed = true;
      }
    }
  }
  for (const pid of found) {
    const started = alive.get(pid);
    if (started) {
      descendants.set(pid, started);
    }
  }
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-enable node/no-sync */
/* oxlint-enable eslint/max-statements */
const terminate = (signal: NodeJS.Signals): void => {
  trackChildren();
  for (const pid of descendants.keys()) {
    try {
      process.kill(pid, signal);
    } catch {
      /* Already exited. */
    }
  }
};
const signals: NodeJS.Signals[] = ["SIGTERM", "SIGINT"];
for (const signal of signals) {
  // oxlint-disable-next-line eslint/no-loop-func -- Signal handlers intentionally update the shared shutdown flag.
  process.on(signal, (): void => {
    stopping = true;
    terminate("SIGTERM");
  });
}
let backoff = 5000;
let failedStartups = 0;
/* oxlint-disable eslint/no-console -- dev-supervisor.ts: This command or desktop boundary reports startup, progress and failures to its operator. */
/* oxlint-disable node/no-process-env -- dev-supervisor.ts: This process boundary owns environment loading/forwarding; consumers receive the resulting validated configuration. */
/* oxlint-disable eslint/no-magic-numbers -- dev-supervisor.ts: Exit/status codes, timeouts and OS/protocol bounds retain this command's operational contract. */
/* oxlint-disable eslint/no-undefined -- dev-supervisor.ts: The API distinguishes omitted/undefined values from null or a concrete result; preserve that sentinel. */
// oxlint-disable-next-line eslint/no-unmodified-loop-condition -- Process signal and exit callbacks update these flags while the loop awaits.
while (!stopping) {
  console.info("Starting ChatJS and managed Eve runtime");
  child = spawn(process.execPath, ["run", "dev"], {
    detached: true,
    env: { ...process.env, NODE_OPTIONS: "--max-old-space-size=4096" },
    stdio: "inherit",
  });
  let exited = false;
  child.once("exit", (): void => {
    exited = true;
  });
  child.once("error", (): void => {
    exited = true;
  });
  const started = Date.now();
  let failures = 0;
  let wasReady = false;
  let lastReadyAt = started;
  // oxlint-disable-next-line eslint/no-unmodified-loop-condition -- Process signal and exit callbacks update these flags while the loop awaits.
  while (!stopping && !exited) {
    trackChildren();
    try {
      // oxlint-disable-next-line eslint/no-await-in-loop -- Wait for each bounded stream read, readiness attempt, or shared fixture before continuing.
      await checkHealth(origin);
      if (!wasReady) {
        console.info("ChatJS, Eve and database are ready");
      }
      wasReady = true;
      failedStartups = 0;
      lastReadyAt = Date.now();
      failures = 0;
      backoff = 5000;
    } catch {
      failures += 1;
      if (
        shouldRestartAfterReadinessFailures(
          failures,
          Date.now() - lastReadyAt,
          wasReady,
          failedStartups
        )
      ) {
        console.error(
          "Readiness remained unavailable through the recovery grace period; restarting the local runtime"
        );
        break;
      }
    }
    // oxlint-disable-next-line eslint/no-await-in-loop -- Wait for each bounded stream read, readiness attempt, or shared fixture before continuing.
    await sleep(10_000);
  }
  if (!wasReady) {
    failedStartups += 1;
  }
  terminate("SIGTERM");
  // oxlint-disable-next-line eslint/no-await-in-loop -- Wait for each bounded stream read, readiness attempt, or shared fixture before continuing.
  await sleep(2000);
  terminate("SIGKILL");
  child = undefined;
  descendants = new Map();
  if (!stopping) {
    console.info(`Restarting in ${backoff / 1000}s`);
    // oxlint-disable-next-line eslint/no-await-in-loop -- Wait for each bounded stream read, readiness attempt, or shared fixture before continuing.
    await sleep(backoff);
    backoff = Math.min(backoff * 2, 60_000);
  }
}
/* oxlint-enable eslint/no-undefined */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable node/no-process-env */
/* oxlint-enable eslint/no-console */
