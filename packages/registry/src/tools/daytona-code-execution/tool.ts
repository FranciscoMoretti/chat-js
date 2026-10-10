import type {
  CodeExecutionContext,
  CodeExecutor,
} from "@/lib/eve/code-executor";
import { codeExecutionInput, codeExecutionResult } from "./schemas";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import { defineTool } from "eve/tools";
import { env } from "@/lib/env";
import { eveCodeSandboxOwnership } from "@/lib/eve/code-sandbox-ownership";
// oxlint-disable-next-line sort-imports -- Preserve ownership's database/environment initialization before logger constructs Pino; sorting createModuleLogger first changes the validation and host setup order.
import { createModuleLogger } from "@/lib/logger";
// oxlint-disable-next-line sort-imports -- Preserve database validation and Pino initialization before Daytona → axios → https-proxy-agent/debug mutates process.env.DEBUG and probes tty.isatty; native sorting moves that host work earlier.
import { createDaytonaProvider } from "./sandbox";
import { executeInDaytona } from "./execution";
import { executeWithToolUsage } from "@/lib/eve/tool-usage";
// oxlint-disable-next-line import/max-dependencies -- This native tool integrates schemas, provider execution, durable ownership and cleanup; the retained dependency-count boundary remains under review.
import { toolResultToModelOutput } from "@/lib/eve/tool-model-output";
import { withCodeSandboxCleanup } from "@/lib/ai/installed-tool-capabilities";

const EXECUTION_TIMEOUT_MS = 300_000;
const EXECUTION_COST_USD = 0.05;
const NO_COST_USD = 0;
// One SDK event connection per loaded worker module. Environment is fixed for
// the worker lifetime; restart with the original scope to reconcile old intents.
const providerCache: { current?: ReturnType<typeof createDaytonaProvider> } =
  {};
const provider = (): ReturnType<typeof createDaytonaProvider> => {
  providerCache.current ??= createDaytonaProvider({
    apiKey: env.DAYTONA_API_KEY ?? "",
    organizationId: env.DAYTONA_ORGANIZATION_ID ?? "",
  });
  return providerCache.current;
};

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve executeCode's awaited sequencing and rejected-Promise behavior. */
const executeCode: CodeExecutor = async (
  input,
  context: ReadonlyNativeSurface<CodeExecutionContext>
) =>
  await executeWithToolUsage(context, async (usage) => {
    usage.addCostUsd(NO_COST_USD);
    const signal = AbortSignal.any([
      AbortSignal.timeout(EXECUTION_TIMEOUT_MS),
      context.abortSignal,
    ]);
    try {
      const result = await executeInDaytona(
        input,
        provider(),
        eveCodeSandboxOwnership(context),
        signal
      );
      const output = codeExecutionResult.parse(result);
      usage.addCostUsd(EXECUTION_COST_USD);
      return output;
    } catch (error) {
      createModuleLogger("daytona-code-execution").error(
        {
          callId: context.callId,
          language: input.language,
          // oxlint-disable-next-line no-ternary -- Keep reason as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
          reason: error instanceof Error ? error.message : "Unknown error",
          sessionId: context.session.id,
        },
        "Sandbox execution failed"
      );
      return usage.fail();
    }
  });
/* oxlint-enable oxc/no-async-await */
const codeExecution = withCodeSandboxCleanup(
  defineTool({
    description:
      "Execute Python or JavaScript in an isolated Daytona sandbox. Use print/console.log, assign result/results, or return a JavaScript value. Python supports numpy, pandas, matplotlib, sympy and yfinance; extra packages may use !pip install. Assign chart for interactive line/scatter/bar charts or use matplotlib for PNG output. Execution is limited to five minutes; files are ephemeral and removed after execution.",
    execute: executeCode,
    inputSchema: codeExecutionInput,
    toModelOutput: toolResultToModelOutput,
  }),
  { createCleanupSession: () => provider().cleanup }
);

/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (codeExecution, executeCode); the enabled import/no-default-export convention rejects the default-export alternative. */
export { codeExecution, executeCode };
/* oxlint-enable import/no-named-export */
