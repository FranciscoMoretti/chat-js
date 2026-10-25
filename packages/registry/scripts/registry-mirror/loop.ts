import { setTimeout as delay } from "node:timers/promises";
import { changedInputs } from "./inputs";

/** Watch before the first snapshot; drain edits during a pass before declaring readiness. */
export const runMirrorLoop = async (
  options: Readonly<{
    snapshot: () => Promise<Record<string, string>>;
    synchronize: () => Promise<void>;
    succeeded: (settled: boolean) => void;
    failed: (error: unknown) => void;
    subscribe: (changed: () => void) => () => void;
    signal: AbortSignal;
    debounceMs?: number;
    pollMs?: number;
  }>
): Promise<void> => {
  let wake = Promise.withResolvers<boolean>();
  let revision = 0;
  let pendingSuccess = false;
  let attempted: Record<string, string> | undefined;
  const changed = (): void => {
    revision += 1;
    wake.resolve(true);
  };
  const unsubscribe = options.subscribe(changed);
  const poll = setInterval(changed, options.pollMs ?? 2000);
  options.signal.addEventListener("abort", changed, { once: true });
  try {
    while (!options.signal.aborted) {
      const observed = revision;
      try {
        // oxlint-disable-next-line no-await-in-loop -- Coalesce rapid saves before taking the generation snapshot.
        await delay(options.debounceMs ?? 80);
        // oxlint-disable-next-line no-await-in-loop -- Each snapshot brackets one serialized generation/apply pass.
        const current = await options.snapshot();
        if (options.signal.aborted) {
          break;
        }
        if (!attempted || changedInputs(attempted, current).length > 0) {
          attempted = current;
          // oxlint-disable-next-line no-await-in-loop -- Never interrupt a writer; edits are reconciled by the next snapshot.
          await options.synchronize();
          pendingSuccess = true;
        }
        // Always verify after generation, including delayed filesystem events.
        // oxlint-disable-next-line no-await-in-loop -- The quiet window coalesces bursts and reconciles startup changes before app launch.
        await delay(options.debounceMs ?? 80);
        // oxlint-disable-next-line no-await-in-loop -- Compare content, not only potentially coalesced filesystem notifications.
        const after = await options.snapshot();
        const settled = changedInputs(current, after).length === 0;
        if (pendingSuccess && !options.signal.aborted) {
          options.succeeded(settled);
          pendingSuccess = !settled;
        }
        if (!settled) {
          continue;
        }
      } catch (error) {
        attempted = undefined;
        options.failed(error);
      }
      if (observed !== revision) {
        continue;
      }
      wake = Promise.withResolvers<boolean>();
      if (!options.signal.aborted) {
        // oxlint-disable-next-line no-await-in-loop -- Remain idle until an edit, safety poll or shutdown.
        await wake.promise;
      }
    }
  } finally {
    clearInterval(poll);
    unsubscribe();
    options.signal.removeEventListener("abort", changed);
  }
};
