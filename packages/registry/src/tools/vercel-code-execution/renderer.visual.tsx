import { getInstanceByDom } from "echarts";
import type * as EChartsForReact from "echarts-for-react/lib/index";
import type { ComponentType } from "react";
import { act } from "react";
import { expect, test, vi } from "vitest";

import {
  captureChatStory,
  makeCanvasDataUri,
  settleAnimations,
} from "../_shared/visual";
import type { ChatState } from "../_shared/visual";
import { CodeExecution } from "./renderer";

// Use the real chart implementation instead of the dynamic (ssr:false) wrapper.
vi.mock(
  "@/components/interactive-charts",
  () => import("../../../../../apps/chat/components/interactive-chart-impl")
);

// echarts-for-react defaults to the CANVAS renderer, whose bitmap is drawn at
// runtime and lives outside the DOM — it replays blank from the archive. Force
// the SVG renderer so the chart is serialized into the archive as vector markup
// and survives replay. (The full `echarts` build /lib/index pulls in already
// registers the SVG renderer, so `opts.renderer` is all that's needed.) Also
// disable echarts' entry animation: with it on, the chart finishes animating ~1s
// after mount, which races the settle poll (a flaky timeout) and would serialize
// a mid-animation frame — turning it off makes the chart render final and instant.
vi.mock("echarts-for-react/lib/index", async (importOriginal) => {
  const actual = await importOriginal<typeof EChartsForReact>();
  // echarts-for-react is CJS; depending on interop the component class may sit
  // one or more `default` levels deep. Unwrap until we reach the function.
  let real: unknown = actual;
  while (real && typeof real !== "function") {
    real = (real as { default?: unknown }).default;
  }
  const Real = real as ComponentType<Record<string, unknown>>;
  // Closes over the interop-unwrapped `Real`, so it can't move to module scope.
  // oxlint-disable-next-line unicorn/consistent-function-scoping
  const Wrapped = (props: Record<string, unknown>) => (
    <Real
      {...props}
      opts={{
        ...(props.opts as Record<string, unknown> | undefined),
        renderer: "svg",
      }}
      option={{
        ...(props.option as Record<string, unknown> | undefined),
        animation: false,
      }}
    />
  );
  // echarts-for-react is CJS with `__esModule`, so the impl's `import X from`
  // unwraps to `.default`. Keep that marker or the interop hands back this whole
  // module object as the component (React then sees an object, not a function).
  return { ...actual, __esModule: true, default: Wrapped };
});

const code = [
  "import matplotlib.pyplot as plt",
  "",
  "plt.plot([1, 2, 3], [2, 4, 3])",
  "plt.title('Quarterly revenue')",
  "plt.show()",
].join("\n");

const seriesChart = (type: "line" | "scatter", title: string) => ({
  elements: [
    {
      label: "Series",
      points: [
        [1, 2],
        [2, 4],
        [3, 3],
        [4, 6],
      ],
    },
  ],
  title,
  type,
});

const barChart = {
  elements: [
    { group: "Q1", label: "Revenue", value: 4 },
    { group: "Q2", label: "Revenue", value: 6 },
    { group: "Q3", label: "Revenue", value: 5 },
  ],
  title: "Bar chart",
  type: "bar" as const,
};

// A canvas PNG is already a `data:` URI, so it replays intact; the renderer
// wants the bare base64 payload (the part after the `data:...,` prefix).
const pngDataUri = makeCanvasDataUri(600, 200, (ctx, width, height) => {
  ctx.fillStyle = "#e5e7eb";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#2563eb";
  ctx.fillRect(40, 50, 140, 150);
  ctx.fillRect(220, 10, 140, 190);
  ctx.fillRect(400, 90, 140, 110);
});
const [, pngBase64] = pngDataUri.split(",");

// Every state renders the real code editor (shiki highlights asynchronously),
// so wait for its highlighted markup before capturing.
const waitForCodeEditor = (section: HTMLElement) =>
  expect.poll(() => Boolean(section.querySelector("pre"))).toBe(true);

// Wait for the chart to paint, its entry animation (Framer opacity + echarts) to
// finish, then strip echarts' per-instance id (`ec_<counter>`) — the one
// attribute that varies run-to-run — so the archive is byte-stable.
const settleChart = async (section: HTMLElement) => {
  await waitForCodeEditor(section);
  await expect
    .poll(() => section.querySelectorAll("svg").length)
    .toBeGreaterThanOrEqual(1);
  await settleAnimations();
  await expect
    .poll(() =>
      [...section.querySelectorAll<HTMLElement>("[_echarts_instance_]")].every(
        (el) => getInstanceByDom(el)?.getZr().animation.isFinished()
      )
    )
    .toBe(true);
  for (const el of section.querySelectorAll("[_echarts_instance_]")) {
    el.removeAttribute("_echarts_instance_");
  }
};

const outputState = (
  label: string,
  chart: Record<string, unknown>,
  settle: (section: HTMLElement) => Promise<void>,
  toolCallId: string
): ChatState => ({
  label,
  settle,
  ui: (
    <CodeExecution
      tool={{
        input: { code, language: "python", title: "Quarterly revenue" },
        output: { chart, message: "Rendered 1 figure." },
        state: "output-available",
        toolCallId,
      }}
    />
  ),
});

test("vercel-code-execution renders every state in the chat", () =>
  captureChatStory("vercel-code-execution", [
    {
      label: "Running",
      settle: waitForCodeEditor,
      ui: (
        <CodeExecution
          tool={{
            input: { code, language: "python", title: "Quarterly revenue" },
            state: "input-available",
            toolCallId: "code-running",
          }}
        />
      ),
    },
    outputState(
      "Line chart output",
      seriesChart("line", "Line chart"),
      settleChart,
      "code-line"
    ),
    outputState("Bar chart output", barChart, settleChart, "code-bar"),
    outputState(
      "Image output",
      { base64: pngBase64, format: "png" },
      async (section) => {
        await waitForCodeEditor(section);
        const img = section.querySelector("img");
        if (!img) {
          throw new Error("PNG output missing");
        }
        await act(async () => {
          await img.decode();
        });
      },
      "code-png"
    ),
  ]));
