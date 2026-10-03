import { takeSnapshot } from "@uiverify/vitest";
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import { getInstanceByDom } from "echarts";
/* oxlint-enable eslint/sort-imports */
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import React, { act } from "react";
/* oxlint-enable eslint/sort-imports */
import { createRoot } from "react-dom/client";
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import { expect, test, vi } from "vitest";
/* oxlint-enable eslint/sort-imports */
import type { z } from "zod";

/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import type { ToolRendererProps } from "@/lib/ai/define-tool-renderer";
/* oxlint-enable eslint/sort-imports */

/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { GetWeatherRenderer } from "../src/tools/get-weather/renderer";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-enable eslint/sort-imports */
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import type {
  weatherInput,
  weatherResult,
} from "../src/tools/get-weather/schemas";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-enable eslint/sort-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { RetrieveUrlRenderer } from "../src/tools/retrieve-url/renderer";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
/* oxlint-disable import/max-dependencies -- This integration composes its explicit adapters here; splitting the imports would hide the dependency boundary without reducing dependencies. */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import type {
  retrievedInput,
  retrievedResult,
} from "../src/tools/retrieve-url/schemas";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-enable import/max-dependencies */
/* oxlint-enable eslint/sort-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { CodeExecution } from "../src/tools/vercel-code-execution/renderer";
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import "../../../apps/chat/app/globals.css";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-enable eslint/sort-imports */

type WeatherAtLocation = z.output<typeof weatherResult>;

/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
vi.mock(
  "@/tools/chatjs/_shared/code-execution/interactive-charts",
  () => import("../src/ui/code-execution/interactive-chart-impl")
);
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */
// Focus this capture on chart output, independently of the code editor.
vi.mock("@/components/sandbox", () => ({ SandboxComposed: () => null }));
/* oxlint-enable unicorn/no-null */
/* oxlint-enable typescript/explicit-function-return-type */

/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */
/* oxlint-disable eslint/no-magic-numbers -- These values are concrete test inputs and expected results; naming each literal would make the fixture harder to compare with its assertions. */
const malformed = [
  { elements: [null], type: "line" },
  { elements: [{ label: "bad", points: "invalid" }], type: "scatter" },
  { elements: [{ label: "bad", points: [[1, "invalid"]] }], type: "line" },
  { elements: [{ group: "g", label: "bad", value: "invalid" }], type: "bar" },
  { elements: [], type: "unknown" },
];
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable unicorn/no-null */

type GetWeatherRendererTool = ToolRendererProps<
  typeof weatherInput,
  typeof weatherResult
>["tool"];
type RetrieveUrlRendererTool = ToolRendererProps<
  typeof retrievedInput,
  typeof retrievedResult
>["tool"];

/* oxlint-disable eslint/no-magic-numbers -- These values are concrete test inputs and expected results; naming each literal would make the fixture harder to compare with its assertions. */
/* oxlint-disable eslint/id-length -- Short callback indices and coordinate keys match the surrounding collection or external data shape; renaming public keys would change the contract. */
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
      (_, index): string => `2026-09-08T${10 + index}:00`
    ),
  },
  hourly_units: { temperature_2m: "°C", time: "iso8601" },
  latitude: 0,
  longitude: 0,
  timezone: "UTC",
  timezone_abbreviation: "UTC",
  utc_offset_seconds: 0,
};
/* oxlint-enable eslint/id-length */
/* oxlint-enable eslint/no-magic-numbers */

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

/* oxlint-disable eslint/max-statements -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable oxc/no-async-await -- Await preserves the existing sequencing, rejection propagation, and cleanup behavior of this asynchronous operation. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable eslint/no-magic-numbers -- These values are concrete test inputs and expected results; naming each literal would make the fixture harder to compare with its assertions. */
/* oxlint-disable react-perf/jsx-no-new-object-as-prop -- This prop reflects the current render values; preserve the existing update behavior rather than add unmeasured memoization. */
/* oxlint-disable eslint/no-ternary -- This expression selects a value without introducing mutable intermediate state or changing evaluation order. */
/* oxlint-disable eslint/no-undefined -- Undefined represents an omitted optional argument or absent value in the existing TypeScript/SDK contract. */
/* oxlint-disable oxc/no-optional-chaining -- Optional access deliberately propagates absence from the external or partially initialized data contract. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
/* oxlint-disable typescript/strict-boolean-expressions -- This value-producing condition preserves the current nullish/empty sentinel behavior; coercing it would change the returned value. */
test("chart output validates shapes and fits PNG output", async (): Promise<void> => {
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
  // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- React act must be awaited to flush queued work before assertions; its synchronous overload is typed void.
  await act((): void => {
    root.render(
      <>
        {outputs.map((chart, index) => (
          <section
            key={JSON.stringify(chart)}
            data-testid={`output-${index}`}
            style={index < malformed.length ? { display: "none" } : undefined}
          >
            <CodeExecution
              isReadonly
              messageId="code-fixture"
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
  await expect
    .poll((): number => container.querySelectorAll("canvas").length)
    .toBe(3);
  await expect
    .poll((): boolean =>
      [...container.querySelectorAll("h3")].every((heading) => {
        const panel = heading.parentElement?.parentElement?.parentElement;
        return panel && getComputedStyle(panel).opacity === "1";
      })
    )
    .toBe(true);
  await expect
    .poll((): boolean =>
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
  // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- React act must be awaited to flush queued work before assertions; its synchronous overload is typed void.
  await act((): void => root.unmount());
  container.remove();
});
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable oxc/no-optional-chaining */
/* oxlint-enable eslint/no-undefined */
/* oxlint-enable eslint/no-ternary */
/* oxlint-enable react-perf/jsx-no-new-object-as-prop */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable eslint/max-statements */

/* oxlint-disable oxc/no-async-await -- Await preserves the existing sequencing, rejection propagation, and cleanup behavior of this asynchronous operation. */
test("weather and retrieved URL renderer states", async (): Promise<void> => {
  const container = document.createElement("main");
  container.style.cssText = "padding:24px;width:1000px;display:grid;gap:16px";
  document.body.append(container);
  const root = createRoot(container);
  // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- React act must be awaited to flush queued work before assertions; its synchronous overload is typed void.
  await act((): void => {
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
  // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- React act must be awaited to flush queued work before assertions; its synchronous overload is typed void.
  await act((): void => root.unmount());
  container.remove();
});
/* oxlint-enable oxc/no-async-await */
