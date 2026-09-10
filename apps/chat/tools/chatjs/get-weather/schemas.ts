import { z } from "zod";

export const weatherInput = z.object({
  latitude: z.number(),
  longitude: z.number(),
});

export const weatherResult = z.object({
  current: z.object({
    time: z.iso.datetime({ local: true }),
    interval: z.number(),
    temperature_2m: z.number(),
  }),
  current_units: z.object({
    time: z.string(),
    interval: z.string(),
    temperature_2m: z.string(),
  }),
  daily: z.object({
    time: z.array(z.string()),
    sunrise: z.array(z.string()).min(1),
    sunset: z.array(z.string()).min(1),
  }),
  daily_units: z.object({
    time: z.string(),
    sunrise: z.string(),
    sunset: z.string(),
  }),
  hourly: z.object({
    time: z.array(z.string()),
    temperature_2m: z.array(z.number()).min(1),
  }),
  hourly_units: z.object({ time: z.string(), temperature_2m: z.string() }),
  latitude: z.number(),
  longitude: z.number(),
  generationtime_ms: z.number(),
  utc_offset_seconds: z.number(),
  timezone: z.string(),
  timezone_abbreviation: z.string(),
  elevation: z.number(),
});
