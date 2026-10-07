import { z } from "zod";

const weatherInput = z.object({
  latitude: z.number(),
  longitude: z.number(),
});

const MINIMUM_FORECAST_SAMPLE_COUNT = 1;
const sunriseSeries = z.array(z.string()).min(MINIMUM_FORECAST_SAMPLE_COUNT);
const sunsetSeries = z.array(z.string()).min(MINIMUM_FORECAST_SAMPLE_COUNT);
const hourlyTemperatures = z
  .array(z.number())
  .min(MINIMUM_FORECAST_SAMPLE_COUNT);
const dailyForecast = z.object({
  sunrise: sunriseSeries,
  sunset: sunsetSeries,
  time: z.array(z.string()),
});
const hourlyForecast = z.object({
  temperature_2m: hourlyTemperatures,
  time: z.array(z.string()),
});

const weatherResult = z.object({
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
  daily: dailyForecast,
  daily_units: z.object({
    sunrise: z.string(),
    sunset: z.string(),
    time: z.string(),
  }),
  elevation: z.number(),
  generationtime_ms: z.number(),
  hourly: hourlyForecast,
  hourly_units: z.object({ temperature_2m: z.string(), time: z.string() }),
  latitude: z.number(),
  longitude: z.number(),
  timezone: z.string(),
  timezone_abbreviation: z.string(),
  utc_offset_seconds: z.number(),
});
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (weatherInput, weatherResult); the enabled import/no-default-export convention rejects the default-export alternative. */
export { weatherInput, weatherResult };
/* oxlint-enable import/no-named-export */
