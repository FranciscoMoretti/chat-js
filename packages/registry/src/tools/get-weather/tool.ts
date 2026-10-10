import { weatherInput, weatherResult } from "./schemas";
import type { ToolUsage } from "@/lib/eve/tool-usage";
import { defineTool } from "eve/tools";
import { executeWithToolUsage } from "@/lib/eve/tool-usage";
import { toolResultToModelOutput } from "@/lib/eve/tool-model-output";
import type { z } from "zod";

const UNBILLED_TOOL_COST_USD = 0;

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (getWeather); the enabled import/no-default-export convention rejects the default-export alternative. */
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
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
