import { defineTool } from "eve/tools";
import type { z } from "zod";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import { toolResultToModelOutput } from "@/lib/eve/tool-model-output";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { ToolUsage } from "@/lib/eve/tool-usage";
/* oxlint-enable sort-imports */
import { executeWithToolUsage } from "@/lib/eve/tool-usage";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { weatherInput, weatherResult } from "./schemas";
/* oxlint-enable sort-imports */

const UNBILLED_TOOL_COST_USD = 0;

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve getWeather's awaited sequencing and rejected-Promise behavior. */
export const getWeather = defineTool({
  description: "Get the current weather at a location",
  execute: async (
    { latitude, longitude }: Readonly<z.infer<typeof weatherInput>>,
    context: Readonly<{ abortSignal: Readonly<AbortSignal> }>
  ) =>
    await executeWithToolUsage(
      context,
      async (usage: Readonly<Pick<ToolUsage, "addCostUsd">>) => {
        const response = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m&hourly=temperature_2m&daily=sunrise,sunset&timezone=auto`,
          { signal: context.abortSignal }
        );
        if (!response.ok) {
          throw new Error("Weather request failed.");
        }
        usage.addCostUsd(UNBILLED_TOOL_COST_USD);
        return weatherResult.parse(await response.json());
      }
    ),
  inputSchema: weatherInput,
  toModelOutput: toolResultToModelOutput,
});
/* oxlint-enable oxc/no-async-await */
