import { tool } from "ai";
import { z } from "zod";

export const getWeather = tool({
  description: "Get the current weather at a location",
  inputSchema: z.object({
    latitude: z.number(),
    longitude: z.number(),
  }),
  execute: async ({
    latitude,
    longitude,
  }: {
    latitude: number;
    longitude: number;
  }) => {
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m&hourly=temperature_2m&daily=sunrise,sunset&timezone=auto`
    );

    const weatherData = await response.json();
    return weatherData as WeatherAtLocation;
  },
});

export interface WeatherAtLocation {
  current: {
    time: string;
    interval: number;
    temperature_2m: number;
  };
  current_units: {
    time: string;
    interval: string;
    temperature_2m: string;
  };
  daily: {
    time: string[];
    sunrise: string[];
    sunset: string[];
  };
  daily_units: {
    time: string;
    sunrise: string;
    sunset: string;
  };
  elevation: number;
  generationtime_ms: number;
  hourly: {
    time: string[];
    temperature_2m: number[];
  };
  hourly_units: {
    time: string;
    temperature_2m: string;
  };
  latitude: number;
  longitude: number;
  timezone: string;
  timezone_abbreviation: string;
  utc_offset_seconds: number;
}
