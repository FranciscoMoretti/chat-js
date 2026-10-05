// oxlint-disable-next-line import/no-nodejs-modules -- The development supervisor owns child processes and restart delays in the host runtime.
import { execFileSync, spawn } from "node:child_process";
// oxlint-disable-next-line import/no-nodejs-modules -- The development supervisor owns child processes and restart delays in the host runtime.
import { setTimeout as delay } from "node:timers/promises";

import { checkHealth } from "./dev-health";
import { shouldRestartAfterReadinessFailures } from "./dev-recovery";

const INITIAL_RESTART_BACKOFF_MS = 5000;
const BACKOFF_MULTIPLIER = 2;
const READINESS_POLL_INTERVAL_MS = 10_000;
const GRACEFUL_SHUTDOWN_DELAY_MS = 2000;
const MAX_RESTART_BACKOFF_MS = 60_000;
const MILLISECONDS_PER_SECOND = 1000;
const NO_READINESS_FAILURES = 0;
const FAILED_STARTUP_INCREMENT = 1;
const EMPTY_VALUE_LENGTH = 0;
const NO_CHILD_PID = 0;

/* oxlint-disable node/no-process-env -- origin: This process boundary owns environment loading/forwarding; consumers receive the resulting validated configuration. */
const origin = process.env.APP_URL;
/* oxlint-enable node/no-process-env */
if (
  typeof origin !== "string" ||
  origin.length === EMPTY_VALUE_LENGTH ||
  !["localhost", "127.0.0.1"].includes(new URL(origin).hostname)
) {
  throw new Error("Run through bun dev:supervise with a local worktree URL.");
}

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
const hasChildProcessId = (pid: number | undefined): pid is number =>
  typeof pid === "number" && pid !== NO_CHILD_PID && !Number.isNaN(pid);
/* oxlint-disable eslint/max-statements -- trackChildren: This ordered transaction/startup operation shares local validation and cleanup; extraction requires lifecycle boundaries. */
/* oxlint-disable node/no-sync -- trackChildren: Startup/discovery consumes this synchronous OS/filesystem API before dependent commands run. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- trackChildren: The database/OS/SDK object retains its declared mutable API; deep-readonly conversion requires an ownership migration. */
const trackChildren = (): void => {
  const childPid = child?.pid;
  if (!hasChildProcessId(childPid)) {
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
  const found = new Set([childPid]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const { pid, parent } of rows) {
      if (
        Boolean(pid) &&
        Boolean(parent) &&
        found.has(parent) &&
        !found.has(pid)
      ) {
        found.add(pid);
        changed = true;
      }
    }
  }
  for (const pid of found) {
    const started = alive.get(pid);
    if (typeof started === "string" && started.length > EMPTY_VALUE_LENGTH) {
      descendants.set(pid, started);
    }
  }
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */
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
let backoff = INITIAL_RESTART_BACKOFF_MS;
let failedStartups = NO_READINESS_FAILURES;
/* oxlint-disable eslint/no-console -- dev-supervisor.ts: This command or desktop boundary reports startup, progress and failures to its operator. */
/* oxlint-disable node/no-process-env -- dev-supervisor.ts: This process boundary owns environment loading/forwarding; consumers receive the resulting validated configuration. */
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
  let failures = NO_READINESS_FAILURES;
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
      failedStartups = NO_READINESS_FAILURES;
      lastReadyAt = Date.now();
      failures = NO_READINESS_FAILURES;
      backoff = INITIAL_RESTART_BACKOFF_MS;
    } catch {
      failures += FAILED_STARTUP_INCREMENT;
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
    await sleep(READINESS_POLL_INTERVAL_MS);
  }
  if (!wasReady) {
    failedStartups += FAILED_STARTUP_INCREMENT;
  }
  terminate("SIGTERM");
  // oxlint-disable-next-line eslint/no-await-in-loop -- Wait for each bounded stream read, readiness attempt, or shared fixture before continuing.
  await sleep(GRACEFUL_SHUTDOWN_DELAY_MS);
  terminate("SIGKILL");
  // Clearing the process handle releases the exited ChildProcess between restarts.
  // oxlint-disable-next-line eslint/no-undefined -- Node's optional ChildProcess handle uses undefined to mean no active child.
  child = undefined;
  descendants = new Map();
  if (!stopping) {
    console.info(`Restarting in ${backoff / MILLISECONDS_PER_SECOND}s`);
    // oxlint-disable-next-line eslint/no-await-in-loop -- Wait for each bounded stream read, readiness attempt, or shared fixture before continuing.
    await sleep(backoff);
    backoff = Math.min(backoff * BACKOFF_MULTIPLIER, MAX_RESTART_BACKOFF_MS);
  }
}
/* oxlint-enable node/no-process-env */
/* oxlint-enable eslint/no-console */
