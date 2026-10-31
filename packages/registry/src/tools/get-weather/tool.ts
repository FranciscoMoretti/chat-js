import { toolDefinition } from "./definition";
import type { weatherInput } from "./schemas";
import { weatherResult } from "./schemas";
import type { ToolUsage } from "@/lib/eve/tool-usage";
import { defineTool } from "eve/tools";
import { executeWithToolUsage } from "@/lib/eve/tool-usage";
import { toolResultToModelOutput } from "@/lib/eve/tool-model-output";
import type { z } from "zod";

const UNBILLED_TOOL_COST_USD = 0;

export const getWeather = defineTool({
  description: toolDefinition.description,
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
  inputSchema: toolDefinition.inputSchema,
  toModelOutput: toolResultToModelOutput,
});
