import { env } from "../env";
import { localDeletionAvailable } from "./local-deletion-available";

const CLEANUP_INTERVAL_MS = 60_000;

type CleanupScheduler = {
  stop: () => void;
  start: () => void;
  run: () => Promise<void>;
};
const schedulerGlobal: typeof globalThis & {
  chatjsEveGuestCleanup?: CleanupScheduler;
} = globalThis;

function enabled() {
  if (
    env.NODE_ENV !== "development" ||
    env.EVE_ENABLED !== "true" ||
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
}

/** Development only. Never load database clients for a remote or disabled runtime. */
export function startLocalEveGuestCleanup() {
  if (!enabled()) {
    schedulerGlobal.chatjsEveGuestCleanup?.stop();
    return;
  }
  const appRoot = process.cwd();
  const run = async () => {
    if (!enabled()) {
      return;
    }
    const { cleanupExpiredEveGuests } =
      await import("./cleanup-expired-guests");
    const result = await cleanupExpiredEveGuests(appRoot);
    if (result.deletedCount || result.pendingCount) {
      console.info("Local EVE guest cleanup", result);
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
  const scheduler: CleanupScheduler = {
    run,
    start() {
      stopped = false;
      schedule();
    },
    stop() {
      stopped = true;
      clearTimeout(timer);
      timer = undefined;
    },
  };
  async function tick() {
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
      schedule();
    }
  }
  function schedule() {
    if (stopped || running || timer) {
      return;
    }
    timer = setTimeout(tick, CLEANUP_INTERVAL_MS);
    timer.unref();
  }
  schedulerGlobal.chatjsEveGuestCleanup = scheduler;
  scheduler.start();
  return scheduler.stop;
}
