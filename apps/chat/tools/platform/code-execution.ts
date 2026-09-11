import type { Sandbox } from "@vercel/sandbox";
import { tool } from "ai";
import { createModuleLogger } from "@/lib/logger";
import { executeJavaScriptInSandbox } from "./code-execution.javascript";
import { executePythonInSandbox } from "./code-execution.python";
import { codeExecutionInput } from "./code-execution.schemas";
import {
  cleanupSandbox,
  createSandbox,
  getErrorMessage,
  getSandboxRuntime,
} from "./code-execution.shared";
import type { SupportedExecutionLanguage } from "./code-execution.types";

const COST_CENTS = 5; // Vercel Sandbox execution

export const codeExecution = ({
  costAccumulator,
  sandboxName,
}: {
  sandboxName?: string;
  costAccumulator?: { addAPICost(name: string, cost: number): void };
}) =>
  tool({
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
    inputSchema: codeExecutionInput,
    execute: async (
      {
        code,
        title,
        language,
      }: {
        code: string;
        title: string;
        language: SupportedExecutionLanguage;
      },
      { abortSignal }
    ) => {
      const log = createModuleLogger("code-execution");
      const requestId = `ci-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const runtime = getSandboxRuntime(language);

      let sandbox: Sandbox | undefined;
      let cleanup: Promise<void> | undefined;
      const stop = () => {
        if (!cleanup) {
          cleanup = cleanupSandbox(sandbox, log, requestId);
          // An abort listener starts cleanup before execution unwinds. Observe
          // early rejection now; the finally block still awaits and propagates it.
          cleanup.catch(() => undefined);
        }
      };

      try {
        log.info({ requestId, title, runtime, language }, "creating sandbox");
        sandbox = await createSandbox(runtime, abortSignal, sandboxName);
        abortSignal?.addEventListener("abort", stop, { once: true });
        abortSignal?.throwIfAborted();
        log.debug({ requestId }, "sandbox created");

        log.info({ requestId, title, language }, "executing code");
        const result =
          language === "javascript"
            ? await executeJavaScriptInSandbox({
                sandbox,
                code,
                log,
                requestId,
              })
            : await executePythonInSandbox({
                sandbox,
                code,
                log,
                requestId,
              });

        costAccumulator?.addAPICost("codeExecution", COST_CENTS);

        return result;
      } catch (err) {
        log.error({ err, requestId, language }, "code execution failed");
        return {
          message: `Sandbox execution failed: ${getErrorMessage(err)}`,
          chart: "",
        };
      } finally {
        abortSignal?.removeEventListener("abort", stop);
        stop();
        await cleanup;
      }
    },
  });
