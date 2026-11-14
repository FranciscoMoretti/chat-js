import { afterAll, afterEach, expect, spyOn, test } from "bun:test";
import { testToolContext } from "../../../../../apps/chat/tests/helpers/eve-tool-context";
import { getWeather } from "./tool";

const upstream = spyOn(globalThis, "fetch");
afterEach(() => {
  upstream.mockReset();
});
afterAll(() => {
  upstream.mockRestore();
});

const forecast = {
  current: { interval: 900, temperature_2m: 20, time: "2026-09-08T12:00" },
  current_units: { interval: "seconds", temperature_2m: "°C", time: "iso8601" },
  daily: {
    sunrise: ["2026-09-08T06:00"],
    sunset: ["2026-09-08T19:00"],
    time: ["2026-09-08"],
  },
  daily_units: { sunrise: "iso8601", sunset: "iso8601", time: "iso8601" },
  hourly: { temperature_2m: [20], time: ["2026-09-08T12:00"] },
  hourly_units: { temperature_2m: "°C", time: "iso8601" },
  elevation: 0,
  generationtime_ms: 0,
  latitude: 1,
  longitude: 2,
  timezone: "UTC",
  timezone_abbreviation: "UTC",
  utc_offset_seconds: 0,
};

test("weather returns validated native data and forwards cancellation to the provider", async () => {
  upstream.mockResolvedValue(Response.json(forecast));
  const context = testToolContext();
  expect(
    await getWeather.execute({ latitude: 1, longitude: 2 }, context)
  ).toEqual(forecast);
  expect(upstream).toHaveBeenCalledTimes(1);
  expect(upstream).toHaveBeenCalledWith(
    expect.stringContaining("latitude=1&longitude=2"),
    { signal: context.abortSignal }
  );
});

test("weather rejects failed and malformed provider responses", async () => {
  upstream.mockResolvedValueOnce(new Response("unavailable", { status: 503 }));
  const failed = getWeather.execute(
    { latitude: 1, longitude: 2 },
    testToolContext()
  );
  expect(failed).rejects.toThrow("Weather request failed.");
  await Promise.resolve(failed).catch(() => null);
  upstream.mockResolvedValueOnce(Response.json({ current: {} }));
  const malformed = getWeather.execute(
    { latitude: 1, longitude: 2 },
    testToolContext()
  );
  expect(malformed).rejects.toThrow();
  await Promise.resolve(malformed).catch(() => null);
});

test("cancelled weather calls do not contact the provider", async () => {
  const controller = new AbortController();
  controller.abort();
  const result = getWeather.execute(
    { latitude: 1, longitude: 2 },
    testToolContext({ abortSignal: controller.signal })
  );
  expect(result).rejects.toThrow();
  await Promise.resolve(result).catch(() => null);
  expect(upstream).not.toHaveBeenCalled();
});
