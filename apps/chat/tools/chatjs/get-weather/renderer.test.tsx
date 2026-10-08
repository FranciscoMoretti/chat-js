import { expect, test } from "vitest";
import { GetWeatherRenderer } from "./renderer";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { weatherResult } from "./schemas";
import type { z } from "zod";

type WeatherAtLocation = z.output<typeof weatherResult>;

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): weather uses 10, 11, 12, 13, 14, 15, 16, 17 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
const weather: WeatherAtLocation = {
  current: { interval: 900, temperature_2m: 20, time: "2026-09-08T20:00" },
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
      (_hour, hourIndex) => `2026-09-08T${10 + hourIndex}:00`
    ),
  },
  hourly_units: { temperature_2m: "°C", time: "iso8601" },
  latitude: 0,
  longitude: 0,
  timezone: "UTC",
  timezone_abbreviation: "UTC",
  utc_offset_seconds: 0,
};
/* oxlint-enable no-magic-numbers */

/* oxlint-disable react-perf/jsx-no-new-object-as-prop -- * react-perf/jsx-no-new-object-as-prop (#558): test.each([ ["2026-09-08T12:00", ["12PM", "1PM", "2PM", "3PM", "4PM", "5PM"]], ["2026 creates render-local values that capture current state; memoization needs dependency and consumer-identity review rather than unconditional hoisting. */
test.each([
  ["2026-09-08T12:00", ["12PM", "1PM", "2PM", "3PM", "4PM", "5PM"]],
  ["2026-09-08T20:00", ["12PM", "1PM", "2PM", "3PM", "4PM", "5PM"]],
])("keeps a complete forecast row at %s", (time, hours: readonly string[]) => {
  const html = renderToStaticMarkup(
    <GetWeatherRenderer
      isReadonly
      messageId="weather-test"
      tool={{
        input: { latitude: 0, longitude: 0 },
        // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing weather own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement. Keep the existing weather.current own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
        output: { ...weather, current: { ...weather.current, time } },
        state: "output-available",
        toolCallId: "weather-test",
      }}
    />
  );
  for (const hour of hours) {
    expect(html).toContain(`>${hour}</div>`);
  }
  expect(html).not.toContain(">10AM</div>");
  expect(html).not.toContain(">11AM</div>");
});
/* oxlint-enable react-perf/jsx-no-new-object-as-prop */
