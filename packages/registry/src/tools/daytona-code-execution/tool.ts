/* oxlint-disable typescript/prefer-readonly-parameter-types -- The CodeExecutor implements native mutable EVE context and usage accounting interfaces. */
/* oxlint-disable import/max-dependencies -- The installed tool explicitly composes native execution, usage, authorization and provider cleanup contracts. */
import { defineTool } from "eve/tools";

import { withCodeSandboxCleanup } from "@/lib/ai/installed-tool-capabilities";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { env } from "@/lib/env";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { CodeExecutor } from "@/lib/eve/code-executor";
/* oxlint-enable sort-imports */
import { eveCodeSandboxOwnership } from "@/lib/eve/code-sandbox-ownership";
import { toolResultToModelOutput } from "@/lib/eve/tool-model-output";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { executeWithToolUsage } from "@/lib/eve/tool-usage";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { createModuleLogger } from "@/lib/logger";
/* oxlint-enable sort-imports */

import { executeInDaytona } from "./execution";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { createDaytonaProvider } from "./sandbox";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { codeExecutionInput, codeExecutionResult } from "./schemas";
/* oxlint-enable sort-imports */

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

const executeCode: CodeExecutor = async (input, context) =>
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
          reason: error instanceof Error ? error.message : "Unknown error",
          sessionId: context.session.id,
        },
        "Sandbox execution failed"
      );
      return usage.fail();
    }
  });

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

export { codeExecution, executeCode };
