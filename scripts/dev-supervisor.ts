import type { ChildProcess } from "node:child_process";
import { execFileSync, spawn } from "node:child_process";
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

type SupervisedChild = Pick<ChildProcess, "pid" | "once" | "removeListener">;
interface SupervisorRuntime {
  readonly health: typeof checkHealth;
  readonly kill: (pid: number, signal: NodeJS.Signals) => void;
  readonly now: () => number;
  readonly sleep: (milliseconds: number, signal?: AbortSignal) => Promise<void>;
  readonly snapshot: () => string;
  readonly start: () => SupervisedChild;
}
type MonitorOutcome = "monitoring" | "shutdown" | "child-exit" | "unhealthy";

const runtime: SupervisorRuntime = {
  health: checkHealth,
  kill: (pid, signal) => {
    process.kill(pid, signal);
  },
  now: Date.now,
  sleep: async (milliseconds, signal) => {
    await delay(milliseconds, undefined, { signal });
  },
  snapshot: () =>
    execFileSync("ps", ["-axo", "pid=,ppid=,lstart="], { encoding: "utf-8" }),
  start: () =>
    spawn(process.execPath, ["run", "dev"], {
      detached: true,
      env: { ...process.env, NODE_OPTIONS: "--max-old-space-size=4096" },
      stdio: "inherit",
    }),
};

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

export const supervise = async (
  origin: string,
  shutdown: AbortSignal,
  environment: SupervisorRuntime = runtime
): Promise<void> => {
  let child: SupervisedChild | undefined;
  let launcherObserved = false;
  let launcherStarted: string | undefined;
  // Eve detaches its worker. Retain its start time after the launcher exits so
  // cleanup can reach it without signalling a process that reused its PID.
  const descendants = new Map<number, string>();

  const trackChildren = (): void => {
    if (!child || !hasChildProcessId(child.pid)) {
      return;
    }
    const rows = parseProcessRows(environment.snapshot());
    const alive = new Map(rows.map((row) => [row.pid, row.started]));
    // Observe once: a reused launcher PID must never become a new root.
    if (!launcherObserved) {
      launcherObserved = true;
      launcherStarted = alive.get(child.pid);
    }
    for (const [pid, started] of descendants) {
      if (alive.get(pid) !== started) {
        descendants.delete(pid);
      }
    }
    if (
      launcherStarted === undefined ||
      alive.get(child.pid) !== launcherStarted
    ) {
      return;
    }
    for (const pid of findDescendants(child.pid, rows)) {
      const started = alive.get(pid);
      if (typeof started === "string" && started.length > EMPTY_VALUE_LENGTH) {
        descendants.set(pid, started);
      }
    }
  };
  const terminate = (signal: NodeJS.Signals): void => {
    trackChildren();
    for (const pid of descendants.keys()) {
      try {
        environment.kill(pid, signal);
      } catch {
        /* Already exited. */
      }
    }
  };
  const handleShutdown = (): void => {
    terminate("SIGTERM");
  };

  const monitorChild = async (
    currentChild: SupervisedChild,
    failedStartups: number
  ): Promise<{ outcome: MonitorOutcome; wasReady: boolean }> => {
    const exited = new AbortController();
    const handleExit = (): void => {
      exited.abort();
    };
    currentChild.once("exit", handleExit);
    currentChild.once("error", handleExit);
    const signal = AbortSignal.any([shutdown, exited.signal]);
    let outcome: MonitorOutcome = "monitoring";
    let failures = NO_READINESS_FAILURES;
    let wasReady = false;
    let lastReadyAt = environment.now();
    try {
      while (outcome === "monitoring") {
        if (signal.aborted) {
          outcome = shutdown.aborted ? "shutdown" : "child-exit";
          continue;
        }
        trackChildren();
        try {
          // oxlint-disable-next-line eslint/no-await-in-loop -- Each probe updates this child's recovery state before deciding whether another probe is allowed.
          await environment.health(origin, signal);
          signal.throwIfAborted();
          if (!wasReady) {
            console.info("ChatJS, Eve and database are ready");
          }
          wasReady = true;
          lastReadyAt = environment.now();
          failures = NO_READINESS_FAILURES;
        } catch {
          if (signal.aborted) {
            outcome = shutdown.aborted ? "shutdown" : "child-exit";
            continue;
          }
          failures += FAILED_STARTUP_INCREMENT;
          if (
            shouldRestartAfterReadinessFailures({
              consecutiveFailures: failures,
              failedStartups: wasReady ? NO_READINESS_FAILURES : failedStartups,
              hasBeenReady: wasReady,
              unreadyForMs: environment.now() - lastReadyAt,
            })
          ) {
            console.error(
              "Readiness remained unavailable through the recovery grace period; restarting the local runtime"
            );
            outcome = "unhealthy";
            continue;
          }
        }
        try {
          // oxlint-disable-next-line eslint/no-await-in-loop -- Space consecutive probes for the current child; cancellation ends the monitor immediately.
          await environment.sleep(READINESS_POLL_INTERVAL_MS, signal);
        } catch (error) {
          if (!signal.aborted) {
            throw error;
          }
          outcome = shutdown.aborted ? "shutdown" : "child-exit";
        }
      }
      return { outcome, wasReady };
    } finally {
      currentChild.removeListener("exit", handleExit);
      currentChild.removeListener("error", handleExit);
    }
  };

  shutdown.addEventListener("abort", handleShutdown, { once: true });
  let outcome: MonitorOutcome = "monitoring";
  let backoff = INITIAL_RESTART_BACKOFF_MS;
  let failedStartups = NO_READINESS_FAILURES;
  try {
    while (outcome !== "shutdown") {
      if (shutdown.aborted) {
        outcome = "shutdown";
        continue;
      }
      console.info("Starting ChatJS and managed Eve runtime");
      launcherObserved = false;
      launcherStarted = undefined;
      child = environment.start();
      try {
        // oxlint-disable-next-line eslint/no-await-in-loop -- Monitor one launcher to completion before cleaning up and starting its replacement.
        const { outcome: monitorOutcome, wasReady } = await monitorChild(
          child,
          failedStartups
        );
        outcome = monitorOutcome;
        if (wasReady) {
          failedStartups = NO_READINESS_FAILURES;
          backoff = INITIAL_RESTART_BACKOFF_MS;
        } else if (outcome !== "shutdown") {
          failedStartups += FAILED_STARTUP_INCREMENT;
        }
      } finally {
        terminate("SIGTERM");
        // oxlint-disable-next-line eslint/no-await-in-loop -- Detached workers get an independent grace period even after the launcher exits or shutdown cancels the monitor.
        await environment.sleep(GRACEFUL_SHUTDOWN_DELAY_MS);
        terminate("SIGKILL");
        child = undefined;
        descendants.clear();
      }
      if (shutdown.aborted) {
        outcome = "shutdown";
      }
      if (outcome !== "shutdown") {
        console.info(`Restarting in ${backoff / MILLISECONDS_PER_SECOND}s`);
        try {
          // oxlint-disable-next-line eslint/no-await-in-loop -- Delay each replacement; shutdown cancels backoff before another child can spawn.
          await environment.sleep(backoff, shutdown);
          backoff = Math.min(
            backoff * BACKOFF_MULTIPLIER,
            MAX_RESTART_BACKOFF_MS
          );
        } catch (error) {
          if (!shutdown.aborted) {
            throw error;
          }
          outcome = "shutdown";
        }
      }
    }
  } finally {
    shutdown.removeEventListener("abort", handleShutdown);
  }
};

if (import.meta.main) {
  const origin = process.env.APP_URL;
  if (
    typeof origin !== "string" ||
    origin.length === EMPTY_VALUE_LENGTH ||
    !["localhost", "127.0.0.1"].includes(new URL(origin).hostname)
  ) {
    throw new Error("Run through bun dev:supervise with a local worktree URL.");
  }
  const shutdown = new AbortController();
  const handleShutdownSignal = (): void => {
    shutdown.abort();
  };
  const signals: NodeJS.Signals[] = ["SIGTERM", "SIGINT"];
  for (const signal of signals) {
    process.on(signal, handleShutdownSignal);
  }
  try {
    await supervise(origin, shutdown.signal);
  } finally {
    for (const signal of signals) {
      process.removeListener(signal, handleShutdownSignal);
    }
  }
}
