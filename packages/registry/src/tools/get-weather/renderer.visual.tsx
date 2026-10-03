/* oxlint-disable eslint/id-length -- Short names follow the callback and canvas conventions of the code they wrap. */
/* oxlint-disable eslint/no-magic-numbers -- Fixture values, viewport widths and canvas sizes are literal test data. */
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
/* oxlint-disable import/no-relative-parent-imports -- Stories import the shared harness from the sibling _shared directory. */
/* oxlint-disable react-perf/jsx-no-new-object-as-prop -- Each story renders once per capture; memoizing fixture props would only add noise. */
/* oxlint-disable typescript/promise-function-async -- Test and settle callbacks return the capture promise directly. */

import React from "react";
import { test } from "vitest";
import type { z } from "zod";

import type { ToolRendererProps } from "@/lib/ai/define-tool-renderer";

import { captureChatStory } from "../_shared/visual";
import { GetWeatherRenderer } from "./renderer";
import type { weatherInput, weatherResult } from "./schemas";

type WeatherAtLocation = z.output<typeof weatherResult>;
type GetWeatherRendererTool = ToolRendererProps<
  typeof weatherInput,
  typeof weatherResult
>["tool"];

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
    {
      label: "Result missing",
      ui: (
        <GetWeatherRenderer
          isReadonly
          messageId={messageId}
          tool={{
            input: { latitude: 0, longitude: 0 },
            state: "output-available",
            toolCallId: "weather-missing",
          }}
        />
      ),
    },
  ]));
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable react-perf/jsx-no-new-object-as-prop */
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-enable eslint/sort-imports */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/id-length */
