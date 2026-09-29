import { defineTool } from "eve/tools";

import { toolResultToModelOutput } from "@/lib/eve/tool-model-output";
import { executeWithToolUsage } from "@/lib/eve/tool-usage";

import { weatherInput, weatherResult } from "./schemas";

export const getWeather = defineTool({
  description: "Get the current weather at a location",
  execute: ({ latitude, longitude }, context) =>
    executeWithToolUsage(context, async (usage) => {
      const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m&hourly=temperature_2m&daily=sunrise,sunset&timezone=auto`,
        { signal: context.abortSignal }
      );
      if (!response.ok) {
        throw new Error("Weather request failed.");
      }
      usage.addCostUsd(0);
      return weatherResult.parse(await response.json());
    }),
  inputSchema: weatherInput,
  toModelOutput: toolResultToModelOutput,
});
