import { execFileSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import {
  findDescendants,
  parseProcessRows,
} from "../../../scripts/dev-process-tree";

/** Remember detached descendants before reparenting; start times guard PID reuse. */
export const trackDemoProcesses = (
  root: number
): { stop: () => Promise<void> } => {
  const descendants = new Map<number, string>();
  let rootStarted: string | undefined;
  let observed = false;
  const refresh = (): void => {
    const rows = parseProcessRows(
      execFileSync("ps", ["-axo", "pid=,ppid=,lstart="], { encoding: "utf-8" })
    );
    const alive = new Map(rows.map((row) => [row.pid, row.started]));
    if (!observed) {
      observed = true;
      rootStarted = alive.get(root);
    }
    for (const [pid, started] of descendants) {
      if (alive.get(pid) !== started) {
        descendants.delete(pid);
      }
    }
    if (rootStarted !== undefined && alive.get(root) === rootStarted) {
      for (const pid of findDescendants(root, rows)) {
        const started = alive.get(pid);
        if (started !== undefined) {
          descendants.set(pid, started);
        }
      }
    }
  };
  const terminate = (signal: NodeJS.Signals): void => {
    refresh();
    for (const pid of descendants.keys()) {
      try {
        process.kill(pid, signal);
      } catch {
        /* Already exited. */
      }
    }
  };
  refresh();
  const timer = setInterval(refresh, 250);
  return {
    stop: async () => {
      clearInterval(timer);
      terminate("SIGTERM");
      // Give EVE its graceful IPC/server-close window, then bound detached cleanup.
      await delay(1000);
      terminate("SIGKILL");
    },
  };
};
