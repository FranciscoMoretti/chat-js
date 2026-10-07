import { env } from "@/lib/env";

import { localDeletionAvailable } from "./local-deletion-available";

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

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (startLocalEveGuestCleanup); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable init-declarations, max-lines-per-function, max-statements, no-console, no-undefined, typescript/strict-void-return --
 * init-declarations (#507): startLocalEveGuestCleanup assigns these bindings along its control-flow paths; eager undefined initialization would conflict with no-undefined and obscure definite assignment.
 * max-lines-per-function (#510): startLocalEveGuestCleanup keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): startLocalEveGuestCleanup keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-console (#514): startLocalEveGuestCleanup emits operational command/error diagnostics through console; selecting another logging transport requires a runtime-specific decision.
 * no-undefined (#519): startLocalEveGuestCleanup uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * typescript/strict-void-return (#611): startLocalEveGuestCleanup's void callback contract discards its result; changing the callback API or operation order solely to hide the return value is unnecessary.
 */
/**
 * Start or refresh the development-only guest cleanup scheduler.
 * Never load database clients for a remote or disabled runtime.
 * @returns {(() => void) | undefined} The scheduler stop callback, or undefined when local cleanup is disabled.
 */
export const startLocalEveGuestCleanup = (): (() => void) | undefined => {
  if (!enabled()) {
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading stop from schedulerGlobal.chatjsEveGuestCleanup; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
    schedulerGlobal.chatjsEveGuestCleanup?.stop();
    return;
  }
  const appRoot = process.cwd();
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve run's awaited sequencing and rejected-Promise behavior. */
  const run = async (): Promise<void> => {
    if (!enabled()) {
      return;
    }
    const { cleanupExpiredEveGuests } =
      await import("./cleanup-expired-guests");
    const result = await cleanupExpiredEveGuests(appRoot);
    if (result.skipped || result.deletedCount || Boolean(result.pendingCount)) {
      console.info("Local EVE guest cleanup", result);
    }
  };
  /* oxlint-enable oxc/no-async-await */
  if (schedulerGlobal.chatjsEveGuestCleanup) {
    // Instrumentation can be reloaded during development. Refresh the callback
    // without adding another timer or overlapping an in-flight sweep.
    schedulerGlobal.chatjsEveGuestCleanup.run = run;
    schedulerGlobal.chatjsEveGuestCleanup.start();
    // oxlint-disable-next-line typescript/consistent-return -- #580: startLocalEveGuestCleanup has an optional result; absent or inapplicable records intentionally return undefined rather than a fabricated value.
    return schedulerGlobal.chatjsEveGuestCleanup.stop;
  }
  let stopped = true;
  let running = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const scheduler: CleanupScheduler = {
    run,
    start(): void {
      stopped = false;
      // oxlint-disable-next-line eslint/no-use-before-define -- The scheduler and timer callbacks are mutually recursive and invoked only after initialization.
      schedule();
    },
    stop(): void {
      stopped = true;
      clearTimeout(timer);
      timer = undefined;
    },
  };
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve tick's awaited sequencing and rejected-Promise behavior. */
  const tick = async (): Promise<void> => {
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
      // oxlint-disable-next-line eslint/no-use-before-define -- The scheduler and timer callbacks are mutually recursive and invoked only after initialization.
      schedule();
    }
  };
  /* oxlint-enable oxc/no-async-await */
  const schedule = (): void => {
    if (stopped || running || timer) {
      return;
    }
    // oxlint-disable-next-line typescript/no-misused-promises -- #585: The scheduled cleanup tick owns rescheduling and its failure boundary; awaiting it from a timer is not possible.
    timer = setTimeout(tick, CLEANUP_INTERVAL_MS);
    timer.unref();
  };
  schedulerGlobal.chatjsEveGuestCleanup = scheduler;
  scheduler.start();
  // oxlint-disable-next-line typescript/consistent-return -- #580: startLocalEveGuestCleanup has an optional result; absent or inapplicable records intentionally return undefined rather than a fabricated value.
  return scheduler.stop;
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable init-declarations, max-lines-per-function, max-statements, no-console, no-undefined, typescript/strict-void-return */
