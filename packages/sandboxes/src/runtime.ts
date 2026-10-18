import type { Sandbox, SandboxOwnership, SandboxProvider } from "./provider.ts";

const EXECUTION_TIMEOUT_MS = 300_000;

const observeCleanup = async (pending: Promise<void>): Promise<void> => {
  try {
    await pending;
  } catch {
    // The owner propagates the same failure in finally.
  }
};

/** Reserve before creation; release only after confirmed cleanup, including cancellation. */
export const withSandbox = async <Result>(
  provider: SandboxProvider,
  options: Readonly<{
    ownership: SandboxOwnership;
    runtime: "python" | "javascript";
    signal: AbortSignal;
  }>,
  execute: (sandbox: Sandbox) => Promise<Result>
): Promise<Result> => {
  const signal = AbortSignal.any([
    options.signal,
    AbortSignal.timeout(EXECUTION_TIMEOUT_MS),
  ]);
  signal.throwIfAborted();
  const name = await options.ownership.reserve(provider.scope, signal);
  // Failed creation is uncertain. Its durable intent must survive for reconciliation.
  const sandbox = await provider.create({
    name,
    runtime: options.runtime,
    signal,
  });
  if (sandbox.name !== name) {
    throw new Error("Sandbox identity does not match its allocation intent.");
  }
  let cleanup: Promise<void> | undefined;
  const stop = (): void => {
    cleanup ??= provider.deleteAndConfirmAbsent(name);
    // Observe immediately, while finally still propagates cleanup failures.
    void observeCleanup(cleanup);
  };
  signal.addEventListener("abort", stop, { once: true });
  if (signal.aborted) {
    stop();
  }
  try {
    await options.ownership.created(name);
    signal.throwIfAborted();
    const result = await execute(sandbox);
    signal.throwIfAborted();
    return result;
  } finally {
    signal.removeEventListener("abort", stop);
    stop();
    await cleanup;
    await options.ownership.release();
    signal.throwIfAborted();
  }
};
