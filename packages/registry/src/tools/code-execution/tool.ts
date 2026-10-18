import type { CodeExecutor } from "@/lib/eve/code-executor";
import { codeExecutionInput, codeExecutionResult } from "./schemas";
import { defineTool } from "eve/tools";
import { eveCodeSandboxOwnership } from "@/lib/eve/code-sandbox-ownership";
import { createModuleLogger } from "@/lib/logger";
import { executeJavaScriptInSandbox } from "@/tools/chatjs/_shared/code-execution/javascript";
import { executePythonInSandbox } from "@/tools/chatjs/_shared/code-execution/python";
import { executeWithToolUsage } from "@/lib/eve/tool-usage";
import { toolResultToModelOutput } from "@/lib/eve/tool-model-output";
import { getSandboxProvider } from "@/lib/sandbox/runtime";
import { withSandbox } from "@chat-js/sandboxes/runtime";

const EXECUTION_COST_USD = 0.05;
const executeCode: CodeExecutor = async (input, context) =>
  await executeWithToolUsage(context, async (usage) => {
    const log = createModuleLogger("code-execution");
    usage.addCostUsd(0);
    try {
      const result = await withSandbox(
        getSandboxProvider(),
        {
          ownership: eveCodeSandboxOwnership(context),
          runtime: input.language,
          signal: context.abortSignal,
        },
        async (sandbox) => {
          const execution = {
            code: input.code,
            log,
            requestId: context.callId,
            sandbox,
          };
          return input.language === "javascript"
            ? await executeJavaScriptInSandbox(execution)
            : await executePythonInSandbox(execution);
        }
      );
      const output = codeExecutionResult.parse(result);
      usage.addCostUsd(EXECUTION_COST_USD);
      return output;
    } catch (error) {
      log.error({ error, callId: context.callId }, "code execution failed");
      return usage.fail();
    }
  });

const codeExecution = defineTool({
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
});
export { codeExecution, executeCode };
