import { z } from "zod";

/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
export const weatherInput = z.object({
  latitude: z.number(),
  longitude: z.number(),
});
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
/* oxlint-disable unicorn/max-nested-calls -- Keep this data transformation together so its argument evaluation order and contextual type inference remain explicit. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
export const weatherResult = z.object({
  current: z.object({
    interval: z.number(),
    temperature_2m: z.number(),
    time: z.iso.datetime({ local: true }),
  }),
  current_units: z.object({
    interval: z.string(),
    temperature_2m: z.string(),
    time: z.string(),
  }),
  daily: z.object({
    sunrise: z.array(z.string()).min(1),
    sunset: z.array(z.string()).min(1),
    time: z.array(z.string()),
  }),
  daily_units: z.object({
    sunrise: z.string(),
    sunset: z.string(),
    time: z.string(),
  }),
  elevation: z.number(),
  generationtime_ms: z.number(),
  hourly: z.object({
    temperature_2m: z.array(z.number()).min(1),
    time: z.array(z.string()),
  }),
  hourly_units: z.object({ temperature_2m: z.string(), time: z.string() }),
  latitude: z.number(),
  longitude: z.number(),
  timezone: z.string(),
  timezone_abbreviation: z.string(),
  utc_offset_seconds: z.number(),
});
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable unicorn/max-nested-calls */
/* oxlint-enable import/group-exports */
