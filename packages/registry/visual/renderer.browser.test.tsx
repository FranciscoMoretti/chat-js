import { takeSnapshot } from "@uiverify/vitest";
import { getInstanceByDom } from "echarts";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";

import type { ToolPartFromTool } from "@/tools/chatjs/_shared/lib/tool-part";

import { GetWeatherRenderer } from "../src/tools/get-weather/renderer";
import type {
  getWeather,
  WeatherAtLocation,
} from "../src/tools/get-weather/tool";
import { RetrieveUrlRenderer } from "../src/tools/retrieve-url/renderer";
import type { retrieveUrl } from "../src/tools/retrieve-url/tool";
import { CodeExecution } from "../src/tools/vercel-code-execution/renderer";

import "../../../apps/chat/app/globals.css";

vi.mock(
  "@/components/interactive-charts",
  () => import("../../../apps/chat/components/interactive-chart-impl")
);

// Focus this capture on chart output, independently of the code editor.
vi.mock("@/components/sandbox", () => ({ SandboxComposed: () => null }));

const malformed = [
  { elements: [null], type: "line" },
  { elements: [{ label: "bad", points: "invalid" }], type: "scatter" },
  { elements: [{ label: "bad", points: [[1, "invalid"]] }], type: "line" },
  { elements: [{ group: "g", label: "bad", value: "invalid" }], type: "bar" },
  { elements: [], type: "unknown" },
];

type GetWeatherRendererTool = ToolPartFromTool<typeof getWeather>;
type RetrieveUrlRendererTool = ToolPartFromTool<typeof retrieveUrl>;

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

const weatherLoadingTool: GetWeatherRendererTool = {
  state: "input-streaming",
  toolCallId: "weather-loading",
};

const weatherOutputTool: GetWeatherRendererTool = {
  input: { latitude: 0, longitude: 0 },
  output: weather,
  state: "output-available",
  toolCallId: "weather-output",
};

const retrieveUrlLoadingTool: RetrieveUrlRendererTool = {
  state: "input-streaming",
  toolCallId: "url-loading",
};

const retrieveUrlErrorTool: RetrieveUrlRendererTool = {
  input: { url: "https://example.com" },
  output: { error: "Unable to retrieve the page" },
  state: "output-available",
  toolCallId: "url-error",
};

const retrieveUrlOutputTool: RetrieveUrlRendererTool = {
  input: { url: "https://example.com" },
  output: {
    results: [
      {
        content: "# A retrieved page\n\nReadable content.",
        description: "A stable renderer fixture",
        language: "English",
        title: "Retrieved page",
        url: "https://example.com",
      },
    ],
  },
  state: "output-available",
  toolCallId: "url-output",
};

test("chart output validates shapes and fits PNG output", async () => {
  const container = document.createElement("main");
  document.documentElement.classList.add("dark");
  container.style.cssText =
    "padding:24px;background:#171717;width:1000px;display:grid;grid-template-columns:1fr 1fr;gap:16px";
  document.body.append(container);
  const root = createRoot(container);
  const canvas = document.createElement("canvas");
  canvas.width = 600;
  canvas.height = 200;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas unavailable");
  }
  context.fillStyle = "#e5e7eb";
  context.fillRect(0, 0, 600, 200);
  context.fillStyle = "#2563eb";
  context.fillRect(40, 50, 140, 150);
  context.fillRect(220, 10, 140, 190);
  context.fillRect(400, 90, 140, 110);
  const png = { base64: canvas.toDataURL().split(",")[1], format: "png" };
  const valid = [
    ...["line", "scatter"].map((type) => ({
      elements: [
        {
          label: "Series",
          points: [
            [1, 2],
            [2, 4],
          ],
        },
      ],
      title: type,
      type,
    })),
    {
      elements: [{ group: "Series", label: "A", value: 4 }],
      title: "bar",
      type: "bar",
    },
  ];
  const outputs = [...malformed, ...valid, png];
  await act(() => {
    root.render(
      <>
        {outputs.map((chart, index) => (
          <section
            key={JSON.stringify(chart)}
            data-testid={`output-${index}`}
            style={index < malformed.length ? { display: "none" } : undefined}
          >
            <CodeExecution
              tool={{
                input: { code: "", language: "python", title: "Chart" },
                output: { chart, message: "" },
                state: "output-available",
                toolCallId: `fixture-${index}`,
              }}
            />
          </section>
        ))}
      </>
    );
  });
  for (let index = 0; index < malformed.length; index += 1) {
    expect(
      container.querySelector(`[data-testid="output-${index}"]`)?.textContent
    ).toBe("");
    expect(
      container.querySelector(`[data-testid="output-${index}"] canvas`)
    ).toBeNull();
  }
  await expect.poll(() => container.querySelectorAll("canvas").length).toBe(3);
  await expect
    .poll(() =>
      [...container.querySelectorAll("h3")].every((heading) => {
        const panel = heading.parentElement?.parentElement?.parentElement;
        return panel && getComputedStyle(panel).opacity === "1";
      })
    )
    .toBe(true);
  await expect
    .poll(() =>
      [
        ...container.querySelectorAll<HTMLElement>("[_echarts_instance_]"),
      ].every((element) =>
        getInstanceByDom(element)?.getZr().animation.isFinished()
      )
    )
    .toBe(true);
  const img = container.querySelector("img");
  if (!img) {
    throw new Error("PNG output missing");
  }
  await img.decode();
  expect(img.naturalWidth).toBe(600);
  expect(img.getBoundingClientRect().width).toBeLessThanOrEqual(900);
  await takeSnapshot("validated-chart-output");
  await act(() => root.unmount());
  container.remove();
});

test("weather and retrieved URL renderer states", async () => {
  const container = document.createElement("main");
  container.style.cssText = "padding:24px;width:1000px;display:grid;gap:16px";
  document.body.append(container);
  const root = createRoot(container);
  await act(() => {
    root.render(
      <>
        <GetWeatherRenderer
          isReadonly
          messageId="weather-loading"
          tool={weatherLoadingTool}
        />
        <GetWeatherRenderer
          isReadonly
          messageId="weather-output"
          tool={weatherOutputTool}
        />
        <RetrieveUrlRenderer
          isReadonly
          messageId="url-loading"
          tool={retrieveUrlLoadingTool}
        />
        <RetrieveUrlRenderer
          isReadonly
          messageId="url-error"
          tool={retrieveUrlErrorTool}
        />
        <RetrieveUrlRenderer
          isReadonly
          messageId="url-output"
          tool={retrieveUrlOutputTool}
        />
      </>
    );
  });
  await takeSnapshot("weather-and-retrieved-url-states");
  await act(() => root.unmount());
  container.remove();
});
