"use client";

import { format, isWithinInterval } from "date-fns";
import { useToolIsCompact } from "@/tools/chatjs/_shared/hooks/use-tool-is-compact";
import { cx } from "@/tools/chatjs/_shared/lib/cx";
import type { TypelessToolPartFromTool } from "@/tools/chatjs/_shared/lib/tool-part";
import type { getWeather, WeatherAtLocation } from "./tool";

type GetWeatherRendererTool = TypelessToolPartFromTool<typeof getWeather>;

const SAMPLE = {
  latitude: 37.763_283,
  longitude: -122.412_86,
  generationtime_ms: 0.027_894_973_754_882_812,
  utc_offset_seconds: 0,
  timezone: "GMT",
  timezone_abbreviation: "GMT",
  elevation: 18,
  current_units: { time: "iso8601", interval: "seconds", temperature_2m: "°C" },
  current: { time: "2024-10-07T19:30", interval: 900, temperature_2m: 29.3 },
  hourly_units: { time: "iso8601", temperature_2m: "°C" },
  hourly: {
    time: [
      "2024-10-07T19:00",
      "2024-10-07T20:00",
      "2024-10-07T21:00",
      "2024-10-07T22:00",
      "2024-10-07T23:00",
      "2024-10-08T00:00",
      "2024-10-08T01:00",
    ],
    temperature_2m: [33.9, 32.1, 28.9, 26.9, 25.2, 23, 21.1],
  },
  daily_units: {
    time: "iso8601",
    sunrise: "iso8601",
    sunset: "iso8601",
  },
  daily: {
    time: ["2024-10-07"],
    sunrise: ["2024-10-07T07:15"],
    sunset: ["2024-10-07T19:00"],
  },
};

function n(num: number): number {
  return Math.ceil(num);
}

function WeatherCard({
  weatherAtLocation,
}: {
  weatherAtLocation: WeatherAtLocation;
}) {
  const currentHigh = Math.max(
    ...weatherAtLocation.hourly.temperature_2m.slice(0, 24)
  );
  const currentLow = Math.min(
    ...weatherAtLocation.hourly.temperature_2m.slice(0, 24)
  );

  const isDay = isWithinInterval(new Date(weatherAtLocation.current.time), {
    start: new Date(weatherAtLocation.daily.sunrise[0]),
    end: new Date(weatherAtLocation.daily.sunset[0]),
  });

  const isCompact = useToolIsCompact();
  const hoursToShow = isCompact ? 5 : 6;
  const currentTimeIndex = weatherAtLocation.hourly.time.findIndex(
    (time) => new Date(time) >= new Date(weatherAtLocation.current.time)
  );
  const startIndex =
    currentTimeIndex >= 0
      ? currentTimeIndex
      : Math.max(0, weatherAtLocation.hourly.time.length - hoursToShow);
  const displayTimes = weatherAtLocation.hourly.time.slice(
    startIndex,
    startIndex + hoursToShow
  );
  const displayTemperatures = weatherAtLocation.hourly.temperature_2m.slice(
    startIndex,
    startIndex + hoursToShow
  );

  return (
    <div
      className={cx(
        "skeleton-bg flex max-w-[500px] flex-col gap-4 rounded-2xl p-4",
        isDay && "bg-blue-400",
        !isDay && "bg-indigo-900"
      )}
    >
      <div className="flex flex-row items-center justify-between">
        <div className="flex flex-row items-center gap-2">
          <div
            className={cx(
              "skeleton-div size-10 rounded-full",
              isDay && "bg-yellow-300",
              !isDay && "bg-indigo-100"
            )}
          />
          <div className="font-medium text-4xl text-blue-50">
            {n(weatherAtLocation.current.temperature_2m)}
            {weatherAtLocation.current_units.temperature_2m}
          </div>
        </div>

        <div className="text-blue-50">{`H:${n(currentHigh)}° L:${n(currentLow)}°`}</div>
      </div>

      <div className="flex flex-row justify-between">
        {displayTimes.map((time, index) => (
          <div className="flex flex-col items-center gap-1" key={time}>
            <div className="text-blue-100 text-xs">
              {format(new Date(time), "ha")}
            </div>
            <div
              className={cx(
                "skeleton-div size-6 rounded-full",
                isDay && "bg-yellow-300",
                !isDay && "bg-indigo-200"
              )}
            />
            <div className="text-blue-50 text-sm">
              {n(displayTemperatures[index])}
              {weatherAtLocation.hourly_units.temperature_2m}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function GetWeatherRenderer({
  tool,
}: {
  tool: GetWeatherRendererTool;
  messageId: string;
  isReadonly: boolean;
}) {
  if (tool.state !== "output-available") {
    return (
      <div className="skeleton" key={tool.toolCallId}>
        <WeatherCard weatherAtLocation={SAMPLE} />
      </div>
    );
  }

  if (!tool.output) {
    return <WeatherCard weatherAtLocation={SAMPLE} />;
  }

  return <WeatherCard weatherAtLocation={tool.output} />;
}
