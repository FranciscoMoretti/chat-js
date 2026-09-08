import { z } from "zod";

// Validate persisted native tool data before passing it to typed ChatJS views.
export const wordCountResult = z.object({
  words: z.number(),
  characters: z.number(),
  charactersNoSpaces: z.number(),
  sentences: z.number(),
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
export const retrievedResult = z.union([
  z.object({ error: z.string() }),
  z.object({
    results: z.array(
      z
        .object({
          title: z.string(),
          content: z.string(),
          url: z.string(),
          description: z.string(),
          language: z.string().optional(),
        })
        .transform((item) => ({ ...item, language: item.language }))
    ),
  }),
  z.object({
    results: z.array(
      z
        .object({ error: z.string().optional() })
        .transform((item) => ({ error: item.error }))
    ),
  }),
]);
