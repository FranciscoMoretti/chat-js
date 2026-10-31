import type { ToolDefinition } from "@/lib/ai/tool-definition";
import { weatherInput, weatherResult } from "./schemas";

export const toolDefinition = {
  name: "getWeather",
  description: "Get the current weather at a location",
  inputSchema: weatherInput,
  outputSchema: weatherResult,
  display: { name: "Weather", shortName: "Weather" },
} as const satisfies ToolDefinition;
