import { execFileSync, spawn } from "node:child_process";
import { checkHealth } from "./dev-health";
import { setTimeout as delay } from "node:timers/promises";
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

const origin = process.env.APP_URL;
if (
  typeof origin !== "string" ||
  origin.length === EMPTY_VALUE_LENGTH ||
  !["localhost", "127.0.0.1"].includes(new URL(origin).hostname)
) {
  throw new Error("Run through bun dev:supervise with a local worktree URL.");
}

let stopping = false;
let child: ReturnType<typeof spawn> | undefined;
// Eve's development runtime detaches its child process. Track descendants
// while the launcher is alive so shutdown also cleans up detached workers.
let descendants = new Map<number, string>();
const hasChildProcessId = (pid: number | undefined): pid is number =>
  typeof pid === "number" && pid !== NO_CHILD_PID && !Number.isNaN(pid);

interface ProcessRow {
  readonly parent: number;
  readonly pid: number;
  readonly started: string;
}

const parseProcessRows = (snapshot: string): ProcessRow[] =>
  snapshot
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

const pruneExitedDescendants = (alive: Readonly<Map<number, string>>): void => {
  for (const [pid, started] of descendants) {
    if (alive.get(pid) !== started) {
      descendants.delete(pid);
    }
  }
};

const findDescendants = (
  rootPid: number,
  rows: readonly ProcessRow[]
): Set<number> => {
  const found = new Set([rootPid]);
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
  return found;
};

const rememberLiveDescendants = (
  found: Readonly<Set<number>>,
  alive: Readonly<Map<number, string>>
): void => {
  for (const pid of found) {
    const started = alive.get(pid);
    if (typeof started === "string" && started.length > EMPTY_VALUE_LENGTH) {
      descendants.set(pid, started);
    }
  }
};

const trackChildren = (): void => {
  if (!child) {
    return;
  }
  const childPid = child.pid;
  if (!hasChildProcessId(childPid)) {
    return;
  }
  const rows = parseProcessRows(
    execFileSync("ps", ["-axo", "pid=,ppid=,lstart="], {
      encoding: "utf-8",
    })
  );
  const alive = new Map(
    rows.map((row: Readonly<(typeof rows)[number]>) => [row.pid, row.started])
  );
  pruneExitedDescendants(alive);
  const found = findDescendants(childPid, rows);
  rememberLiveDescendants(found, alive);
};
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
const handleShutdownSignal = (): void => {
  stopping = true;
  terminate("SIGTERM");
};
const signals: NodeJS.Signals[] = ["SIGTERM", "SIGINT"];
for (const signal of signals) {
  process.on(signal, handleShutdownSignal);
}
let backoff = INITIAL_RESTART_BACKOFF_MS;
let failedStartups = NO_READINESS_FAILURES;
// oxlint-disable-next-line eslint/no-unmodified-loop-condition -- Signal handlers set stopping while readiness probes or delays are awaited; the pinned rule ignores writes inside callbacks.
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
  // oxlint-disable-next-line eslint/no-unmodified-loop-condition -- Signal handlers set stopping and child exit/error handlers set exited while this loop awaits; the pinned rule ignores writes inside callbacks.
  while (!stopping && !exited) {
    trackChildren();
    try {
      // oxlint-disable-next-line eslint/no-await-in-loop -- This probe updates consecutive failures and lastReadyAt before shouldRestartAfterReadinessFailures decides whether to restart the same child.
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
      const unreadyForMs = Date.now() - lastReadyAt;
      if (
        shouldRestartAfterReadinessFailures({
          consecutiveFailures: failures,
          failedStartups,
          hasBeenReady: wasReady,
          unreadyForMs,
        })
      ) {
        console.error(
          "Readiness remained unavailable through the recovery grace period; restarting the local runtime"
        );
        break;
      }
    }
    // oxlint-disable-next-line eslint/no-await-in-loop -- Space probes for this child by READINESS_POLL_INTERVAL_MS; concurrent probes would change the failure counter and recovery grace period.
    await delay(READINESS_POLL_INTERVAL_MS);
  }
  if (!wasReady) {
    failedStartups += FAILED_STARTUP_INCREMENT;
  }
  terminate("SIGTERM");
  // oxlint-disable-next-line eslint/no-await-in-loop -- Wait after SIGTERM before SIGKILL so the current child gets its shutdown grace period before any restart.
  await delay(GRACEFUL_SHUTDOWN_DELAY_MS);
  terminate("SIGKILL");
  // Clearing the process handle releases the exited ChildProcess between restarts.
  child = undefined;
  descendants = new Map();
  if (!stopping) {
    console.info(`Restarting in ${backoff / MILLISECONDS_PER_SECOND}s`);
    // oxlint-disable-next-line eslint/no-await-in-loop -- Delay this restart before doubling the next attempt's backoff and spawning another child.
    await delay(backoff);
    backoff = Math.min(backoff * BACKOFF_MULTIPLIER, MAX_RESTART_BACKOFF_MS);
  }
}
