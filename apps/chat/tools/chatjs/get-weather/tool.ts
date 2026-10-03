import { defineTool } from "eve/tools";

import { toolResultToModelOutput } from "@/lib/eve/tool-model-output";
import { executeWithToolUsage } from "@/lib/eve/tool-usage";

import { weatherInput, weatherResult } from "./schemas";

/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
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
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-magic-numbers */
