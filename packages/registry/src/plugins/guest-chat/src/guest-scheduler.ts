import { env } from "@/lib/env";

import { localDeletionAvailable } from "@/lib/eve/local-deletion-available";

const CLEANUP_INTERVAL_MS = 60_000;

interface CleanupScheduler {
  stop: () => void;
  start: () => void;
  run: () => Promise<void>;
}

const schedulerGlobal: typeof globalThis & {
  chatjsEveGuestCleanup?: CleanupScheduler;
} = globalThis;

const enabled = (): boolean => {
  if (
    env.NODE_ENV !== "development" ||
    !env.EVE_GATEWAY_SECRET ||
    !localDeletionAvailable()
  ) {
    return false;
  }
  try {
    const database = new URL(env.DATABASE_URL);
    return (
      ["postgres:", "postgresql:"].includes(database.protocol) &&
      ["localhost", "127.0.0.1", "[::1]"].includes(database.hostname)
    );
  } catch {
    return false;
  }
};

/**
 * Start or refresh the development-only guest cleanup scheduler.
 * Never load database clients for a remote or disabled runtime.
 * @returns {(() => void) | undefined} The scheduler stop callback, or undefined when local cleanup is disabled.
 */
export const startLocalEveGuestCleanup = (): (() => void) | undefined => {
  if (!enabled()) {
    schedulerGlobal.chatjsEveGuestCleanup?.stop();
    return undefined;
  }
  const run = async (): Promise<void> => {
    if (!enabled()) {
      return;
    }
    const { cleanupGuestRuntimeSessions } = await import("./guest-cleanup");
    const results = await Promise.allSettled([cleanupGuestRuntimeSessions()]);
    for (const result of results) {
      if (
        result.status === "fulfilled" &&
        (result.value.skipped ||
          result.value.deletedCount ||
          Boolean(result.value.pendingCount))
      ) {
        console.info("Local EVE guest cleanup", result.value);
      }
    }
    if (results.some((result) => result.status === "rejected")) {
      throw new Error("Guest cleanup incomplete; the next sweep will retry.");
    }
  };
  if (schedulerGlobal.chatjsEveGuestCleanup) {
    // Instrumentation can be reloaded during development. Refresh the callback
    // without adding another timer or overlapping an in-flight sweep.
    schedulerGlobal.chatjsEveGuestCleanup.run = run;
    schedulerGlobal.chatjsEveGuestCleanup.start();
    return schedulerGlobal.chatjsEveGuestCleanup.stop;
  }
  let stopped = true;
  let running = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const scheduler = {
    run,
    schedule(): void {
      if (stopped || running || timer) {
        return;
      }
      timer = setTimeout(() => {
        void scheduler.tick();
      }, CLEANUP_INTERVAL_MS);
      timer.unref();
    },
    start(): void {
      stopped = false;
      scheduler.schedule();
    },
    stop: (): void => {
      stopped = true;
      clearTimeout(timer);
      timer = undefined;
    },
    async tick(): Promise<void> {
      timer = undefined;
      running = true;
      try {
        await scheduler.run();
      } catch {
        console.error(
          "Local EVE guest cleanup failed; the next sweep will retry."
        );
      } finally {
        running = false;
        scheduler.schedule();
      }
    },
  };
  schedulerGlobal.chatjsEveGuestCleanup = scheduler;
  scheduler.start();
  return scheduler.stop;
};
