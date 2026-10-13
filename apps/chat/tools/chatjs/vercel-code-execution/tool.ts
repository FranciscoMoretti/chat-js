import type {
  CodeExecutionContext,
  CodeExecutor,
} from "@/lib/eve/code-executor";
import { codeExecutionInput, codeExecutionResult } from "./schemas";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import type { Sandbox } from "@vercel/sandbox";
import { defineTool } from "eve/tools";
import { eveCodeSandboxOwnership } from "@/lib/eve/code-sandbox-ownership";
import { createModuleLogger } from "@/lib/logger";
import {
  cleanupSandbox,
  codeSandboxCleanupCapability,
  createSandbox,
  getErrorMessage,
  getSandboxImage,
  resolveSandboxAuth,
} from "./execution-sandbox";
import { executeJavaScriptInSandbox } from "@/tools/chatjs/_shared/code-execution/javascript";
import { executePythonInSandbox } from "@/tools/chatjs/_shared/code-execution/python";
import { executeWithToolUsage } from "@/lib/eve/tool-usage";
import { toolResultToModelOutput } from "@/lib/eve/tool-model-output";
import { withCodeSandboxCleanup } from "@/lib/ai/installed-tool-capabilities";

// Vercel Sandbox execution.
const COST_CENTS = 5;

const observeCleanup = async (
  pending: Readonly<Promise<void>>
): Promise<void> => {
  try {
    await pending;
  } catch {
    // The tool's finally block observes and propagates this cleanup failure.
  }
};

const executeCode: CodeExecutor = async (
  { code, title, language },
  context: ReadonlyNativeSurface<CodeExecutionContext>
) =>
  await executeWithToolUsage(context, async (usage) => {
    const { abortSignal } = context;
    const sandboxOwnership = eveCodeSandboxOwnership(context);
    const log = createModuleLogger("code-execution");
    const requestId = `ci-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const image = getSandboxImage(language);

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
      if (abortSignal !== undefined) {
        abortSignal.throwIfAborted();
      }
      log.info({ language, image, requestId, title }, "creating sandbox");
      const auth =
        sandboxOwnership === undefined ? undefined : resolveSandboxAuth();
      const name = auth
        ? await sandboxOwnership?.reserve(auth, abortSignal)
        : undefined;
      sandbox = await createSandbox(image, abortSignal, name, auth);
      await sandboxOwnership?.created(sandbox.name);
      if (abortSignal !== undefined) {
        abortSignal.addEventListener("abort", stop, { once: true });
        abortSignal.throwIfAborted();
      }
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
      if (abortSignal !== undefined) {
        abortSignal.removeEventListener("abort", stop);
      }
      stop();
      await cleanup;
    }
  });

const codeExecution = withCodeSandboxCleanup(
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
export { codeExecution, executeCode };
