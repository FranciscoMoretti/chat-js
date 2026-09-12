import type { Sandbox } from "@vercel/sandbox";
import { tool } from "ai";
import type { ToolExecutionOptions } from "ai";
import z from "zod";

import type { ChatToolContext } from "@/lib/ai/tool-context";
import { createModuleLogger } from "@/lib/logger";

import { executeJavaScriptInSandbox } from "./javascript";
import { executePythonInSandbox } from "./python";
import {
  cleanupSandbox,
  createSandbox,
  getErrorMessage,
  getSandboxRuntime,
} from "./sandbox";
import { supportedExecutionLanguages } from "./types";
import type { SupportedExecutionLanguage } from "./types";

const COST_CENTS = 5; // Vercel Sandbox execution

const languageSchema = z.enum(supportedExecutionLanguages);

const defaultExecutionLanguage: SupportedExecutionLanguage = "python";

export const codeExecution = tool({
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
    { context }: ToolExecutionOptions<ChatToolContext>
  ) => {
    const { costAccumulator } = context ?? {};
    const log = createModuleLogger("code-execution");
    const requestId = `ci-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const runtime = getSandboxRuntime(language);

    let sandbox: Sandbox | undefined;

    try {
      log.info({ language, requestId, runtime, title }, "creating sandbox");
      sandbox = await createSandbox(runtime);
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

      costAccumulator?.addAPICost("codeExecution", COST_CENTS);

      return result;
    } catch (error) {
      log.error({ error, requestId, language }, "code execution failed");
      return {
        message: `Sandbox execution failed: ${getErrorMessage(error)}`,
        chart: "",
      };
    } finally {
      await cleanupSandbox(sandbox, log, requestId);
    }
  },
  inputSchema: z.object({
    code: z
      .string()
      .describe(
        "The code to execute in the selected sandbox language. Print anything you want to return, or assign to 'result'/'results'."
      ),
    language: languageSchema
      .default(defaultExecutionLanguage)
      .describe("The language to execute: 'python' or 'javascript'."),
    title: z.string().describe("The title of the code snippet."),
  }),
});
