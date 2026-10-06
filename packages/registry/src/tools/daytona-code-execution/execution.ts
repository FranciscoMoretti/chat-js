/* oxlint-disable eslint/max-params, eslint/max-statements -- This lifecycle coordinator keeps allocation, confirmation, cancellation and release in one ordered transaction with its four explicit dependencies. */
import type { CodeExecutionInput } from "@/lib/eve/code-executor";
import { createModuleLogger } from "@/lib/logger";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import { executeJavaScriptInSandbox } from "@/tools/chatjs/_shared/code-execution/javascript";
import { executePythonInSandbox } from "@/tools/chatjs/_shared/code-execution/python";
import type { CodeExecutionResult } from "@/tools/chatjs/_shared/code-execution/types";
/* oxlint-enable sort-imports */

import { commandSandbox } from "./sandbox";
import type { createDaytonaProvider } from "./sandbox";

interface SandboxOwnership {
  reserve: (
    provider: Readonly<{ teamId: string; projectId: string }>,
    signal?: ReadonlyNativeSurface<AbortSignal>
  ) => Promise<string>;
  created: (name: string) => Promise<void>;
  release: () => Promise<void>;
}

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve observeCleanup's awaited sequencing and rejected-Promise behavior. */
const observeCleanup = async (
  pending: Readonly<Promise<void>>
): Promise<void> => {
  try {
    await pending;
  } catch {
    // The owner awaits the same promise in finally and propagates this failure.
  }
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve executeInDaytona's awaited sequencing and rejected-Promise behavior. */
const executeInDaytona = async (
  input: CodeExecutionInput,
  selected: ReadonlyNativeSurface<ReturnType<typeof createDaytonaProvider>>,
  ownership: ReadonlyNativeSurface<SandboxOwnership>,
  signal: ReadonlyNativeSurface<AbortSignal>
): Promise<CodeExecutionResult> => {
  signal.throwIfAborted();
  const name = await ownership.reserve(selected.cleanup.provider, signal);
  // A rejected create is uncertain: preserve its intent for operator reconciliation.
  const resource = await selected.create(name, input.language);
  const cleanup: { pending?: Promise<void> } = {};
  const stop = (): void => {
    cleanup.pending ??= selected.cleanup.deleteAndConfirmAbsent(name);
    // Observe promptly; the finally block propagates any deletion failure.
    void observeCleanup(cleanup.pending);
  };
  signal.addEventListener("abort", stop, { once: true });
  if (signal.aborted) {
    stop();
  }
  try {
    await ownership.created(resource.name);
    signal.throwIfAborted();
    const execution = {
      code: input.code,
      log: createModuleLogger("daytona-code-execution"),
      requestId: name,
      sandbox: commandSandbox(resource, signal),
    };
    const result =
      // oxlint-disable-next-line no-ternary -- Keep result as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
      input.language === "javascript"
        ? await executeJavaScriptInSandbox(execution)
        : await executePythonInSandbox(execution);
    signal.throwIfAborted();
    return result;
  } finally {
    signal.removeEventListener("abort", stop);
    stop();
    await cleanup.pending;
    await ownership.release();
  }
};
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (executeInDaytona); the enabled import/no-default-export convention rejects the default-export alternative. */
/* oxlint-enable oxc/no-async-await */
export { executeInDaytona };
/* oxlint-enable import/prefer-default-export, import/no-named-export */
