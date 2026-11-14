import { toolDefinition } from "./definition";
import { defineTool } from "eve/tools";

export const getWeather = defineTool({
  description: toolDefinition.description,
  inputSchema: toolDefinition.inputSchema,
  outputSchema: toolDefinition.outputSchema,
  execute: async ({ latitude, longitude }, { abortSignal }) => {
    abortSignal.throwIfAborted();
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m&hourly=temperature_2m&daily=sunrise,sunset&timezone=auto`,
      { signal: abortSignal }
    );
    if (!response.ok) {
      throw new Error("Weather request failed.");
    }
    const output = toolDefinition.outputSchema.parse(await response.json());
    abortSignal.throwIfAborted();
    return output;
  },
});
