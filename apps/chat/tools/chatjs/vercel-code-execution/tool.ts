import type { Sandbox } from "@vercel/sandbox";
import { defineTool } from "eve/tools";

import { withCodeSandboxCleanup } from "@/lib/ai/installed-tool-capabilities";
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import type { CodeExecutor } from "@/lib/eve/code-executor";
/* oxlint-enable eslint/sort-imports */
import { eveCodeSandboxOwnership } from "@/lib/eve/code-sandbox-ownership";
import { toolResultToModelOutput } from "@/lib/eve/tool-model-output";
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import { executeWithToolUsage } from "@/lib/eve/tool-usage";
/* oxlint-enable eslint/sort-imports */
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import { createModuleLogger } from "@/lib/logger";
/* oxlint-enable eslint/sort-imports */

/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import {
  cleanupSandbox,
  codeSandboxCleanupCapability,
  createSandbox,
  getErrorMessage,
  getSandboxRuntime,
  resolveSandboxAuth,
} from "./execution-sandbox";
/* oxlint-enable eslint/sort-imports */
import { executeJavaScriptInSandbox } from "./javascript";
/* oxlint-disable import/max-dependencies -- This integration composes its explicit adapters here; splitting the imports would hide the dependency boundary without reducing dependencies. */
import { executePythonInSandbox } from "./python";
/* oxlint-enable import/max-dependencies */
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import { codeExecutionResult, codeExecutionInput } from "./schemas";
/* oxlint-enable eslint/sort-imports */

// Vercel Sandbox execution.
const COST_CENTS = 5;

/* oxlint-disable oxc/no-async-await -- Await preserves the existing sequencing, rejection propagation, and cleanup behavior of this asynchronous operation. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
const observeCleanup = async (pending: Promise<void>): Promise<void> => {
  try {
    await pending;
  } catch {
    // The tool's finally block observes and propagates this cleanup failure.
  }
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable oxc/no-async-await */

/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the ordered validation, state transitions, and cleanup in one operation so their sequencing remains reviewable. */
/* oxlint-disable oxc/no-async-await -- Await preserves the existing sequencing, rejection propagation, and cleanup behavior of this asynchronous operation. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/* oxlint-disable eslint/init-declarations -- The value is assigned by the following guarded operation; an invented initial value would hide an uninitialized control-flow branch. */
/* oxlint-disable oxc/no-optional-chaining -- Optional access deliberately propagates absence from the external or partially initialized data contract. */
/* oxlint-disable eslint/no-ternary -- This expression selects a value without introducing mutable intermediate state or changing evaluation order. */
/* oxlint-disable eslint/no-undefined -- Undefined represents an omitted optional argument or absent value in the existing TypeScript/SDK contract. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
/* oxlint-disable typescript/strict-boolean-expressions -- This value-producing condition preserves the current nullish/empty sentinel behavior; coercing it would change the returned value. */
export const executeCode: CodeExecutor = ({ code, title, language }, context) =>
  executeWithToolUsage(context, async (usage) => {
    const { abortSignal } = context;
    const sandboxOwnership = eveCodeSandboxOwnership(context);
    const log = createModuleLogger("code-execution");
    const requestId = `ci-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const runtime = getSandboxRuntime(language);

    let sandbox: Sandbox | undefined;
    let cleanup: Promise<void> | undefined;
    const cleanupOwnedSandbox = async (): Promise<void> => {
      await cleanupSandbox(sandbox, log, requestId);
      if (sandbox) {
        await sandboxOwnership?.release();
      }
    };
    const stop = (): void => {
      if (!cleanup) {
        cleanup = cleanupOwnedSandbox();
        void observeCleanup(cleanup);
      }
    };

    try {
      abortSignal?.throwIfAborted();
      log.info({ language, requestId, runtime, title }, "creating sandbox");
      const auth = sandboxOwnership ? resolveSandboxAuth() : undefined;
      const name = auth
        ? await sandboxOwnership?.reserve(auth, abortSignal)
        : undefined;
      sandbox = await createSandbox(runtime, abortSignal, name, auth);
      await sandboxOwnership?.created(sandbox.name);
      abortSignal?.addEventListener("abort", stop, { once: true });
      abortSignal?.throwIfAborted();
      log.debug({ requestId }, "sandbox created");

      log.info({ language, requestId, title }, "executing code");
      const result =
        language === "javascript"
          ? await executeJavaScriptInSandbox({
              code,
              log,
              requestId,
              sandbox,
            })
          : await executePythonInSandbox({
              code,
              log,
              requestId,
              sandbox,
            });

      usage.addCostUsd(COST_CENTS / 100);
      return codeExecutionResult.parse(result);
    } catch (error) {
      log.error({ error, language, requestId }, "code execution failed");
      // The fixed application charge applies only to completed executions.
      usage.addCostUsd(0);
      return {
        chart: "",
        message: `Sandbox execution failed: ${getErrorMessage(error)}`,
      };
    } finally {
      abortSignal?.removeEventListener("abort", stop);
      stop();
      await cleanup;
    }
  });
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-undefined */
/* oxlint-enable eslint/no-ternary */
/* oxlint-enable oxc/no-optional-chaining */
/* oxlint-enable eslint/init-declarations */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable import/no-named-export */
/* oxlint-enable eslint/max-statements */
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
export const codeExecution = withCodeSandboxCleanup(
  defineTool({
    description: `Sandboxed code execution for Python and JavaScript.

Use for:
- Execute Python for calculations, data analysis, and visualisations
- Execute JavaScript for scripting, transformations, async fetches, and general runtime checks

Python support:
- matplotlib, pandas, numpy, sympy, yfinance pre-installed — do NOT reinstall them
- Produce interactive line / scatter / bar charts OR matplotlib PNG charts
- Install extra libs by adding lines like: '!pip install <pkg> [<pkg2> ...]' (we auto-install and strip these lines; pre-installed packages are ignored)

JavaScript support:
- Runs in a sandboxed Node.js runtime, never in the browser thread
- Use console.log(...) to print output
- You can also assign 'result' or 'results', or return a value from the snippet

Chart output — Python only:
1. Interactive chart (preferred for line/scatter/bar): assign a 'chart' variable matching this schema:
   chart = {
     "type": "line" | "scatter" | "bar",
     "title": "My Chart",
     "x_label": "X",   # optional
     "y_label": "Y",   # optional
     "x_scale": "datetime" | None,  # optional, for time-series x axes
     "elements": [
       # for line/scatter: {"label": "Series A", "points": [[x1,y1],[x2,y2],...]}
       # for bar: {"label": "Category", "group": "Group A", "value": 42}
     ]
   }
2. Matplotlib PNG: use plt.plot()/plt.savefig() normally (no need to call plt.show())

Restrictions:
- No images in the assistant response; don't embed them
- Interactive chart: only line / scatter / bar types

Output rules:
- Set language to 'python' or 'javascript'
- Python charts: assign 'chart' dict for interactive charts (takes priority over matplotlib PNG)
- Python values: assign 'result' or 'results', or print explicitly
- JavaScript values: assign 'result' or 'results', return a value, or print explicitly
- Don't rely on implicit REPL last-expression output`,
    execute: executeCode,
    inputSchema: codeExecutionInput,
    toModelOutput: toolResultToModelOutput,
  }),
  codeSandboxCleanupCapability
);
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/group-exports */
