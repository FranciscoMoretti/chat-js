import { test } from "vitest";

import type { ToolPartFromTool } from "@/tools/chatjs/_shared/lib/tool-part";

import { captureChatStory } from "../_shared/visual";
import { GetWeatherRenderer } from "./renderer";
import type { getWeather, WeatherAtLocation } from "./tool";

type GetWeatherRendererTool = ToolPartFromTool<typeof getWeather>;

const messageId = "weather-message";

const weather: WeatherAtLocation = {
  current: { interval: 900, temperature_2m: 20, time: "2026-09-08T12:00" },
  current_units: { interval: "seconds", temperature_2m: "°C", time: "iso8601" },
  daily: {
    sunrise: ["2026-09-08T06:00"],
    sunset: ["2026-09-08T19:00"],
    time: ["2026-09-08"],
  },
  daily_units: { sunrise: "iso8601", sunset: "iso8601", time: "iso8601" },
  elevation: 0,
  generationtime_ms: 0,
  hourly: {
    temperature_2m: [10, 11, 12, 13, 14, 15, 16, 17],
    time: Array.from(
      { length: 8 },
      (_, index) => `2026-09-08T${10 + index}:00`
    ),
  },
  hourly_units: { temperature_2m: "°C", time: "iso8601" },
  latitude: 0,
  longitude: 0,
  timezone: "UTC",
  timezone_abbreviation: "UTC",
  utc_offset_seconds: 0,
};

const loadingTool: GetWeatherRendererTool = {
  input: { latitude: 0, longitude: 0 },
  state: "input-available",
  toolCallId: "weather-input",
};

const resolvedTool: GetWeatherRendererTool = {
  input: { latitude: 0, longitude: 0 },
  output: weather,
  state: "output-available",
  toolCallId: "weather-output",
};

test("get-weather renders every state in the chat", () =>
  captureChatStory("get-weather", [
    {
      label: "Fetching (skeleton)",
      ui: (
        <GetWeatherRenderer
          isReadonly
          messageId={messageId}
          tool={loadingTool}
        />
      ),
    },
    {
      label: "Resolved",
      ui: (
        <GetWeatherRenderer
          isReadonly
          messageId={messageId}
          tool={resolvedTool}
        />
      ),
    },
  ]));
