import { getInstanceByDom } from "echarts";
import type * as EChartsForReact from "echarts-for-react/lib/index";
import type { EChartsReactProps } from "echarts-for-react/lib/types";
import { expect } from "vitest";

import { chartsFinished } from "./charts-finished";
import { makeCanvasDataUri, settleAnimations } from "./visual";

/**
 * `vi.mock("echarts-for-react/lib/index", svgECharts)` for stories that render
 * a chart. echarts defaults to the canvas renderer, whose bitmap lives outside
 * the DOM and replays blank from the archive, so force SVG markup instead. Its
 * entry animation is turned off too: it ends ~1s after mount, which races the
 * capture and would record a mid-animation frame.
 */
export const svgECharts = async (
  importOriginal: () => Promise<typeof EChartsForReact>
) => {
  const { default: Real } = await importOriginal();
  // Closes over the original component, so it can't move to module scope.
  // oxlint-disable-next-line unicorn/consistent-function-scoping
  const Wrapped = (props: EChartsReactProps) => (
    <Real
      {...props}
      opts={{ ...props.opts, renderer: "svg" }}
      option={{ ...props.option, animation: false }}
    />
  );
  return { default: Wrapped };
};

export const seriesChart = (type: "line" | "scatter", title: string) => ({
  elements: [
    {
      label: "Series",
      points: [
        [1, 2],
        [2, 4],
        [3, 3],
        [4, 6],
      ] as [number, number][],
    },
  ],
  title,
  type,
});

export const barChart = {
  elements: [
    { group: "Q1", label: "Revenue", value: 4 },
    { group: "Q2", label: "Revenue", value: 6 },
    { group: "Q3", label: "Revenue", value: 5 },
  ],
  title: "Bar chart",
  type: "bar" as const,
};

// A canvas PNG is already a `data:` URI, so it replays intact; the renderers
// want the bare base64 payload (the part after the `data:...,` prefix).
export const pngBase64 =
  makeCanvasDataUri(600, 200, (ctx, width, height) => {
    ctx.fillStyle = "#e5e7eb";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#2563eb";
    ctx.fillRect(40, 50, 140, 150);
    ctx.fillRect(220, 10, 140, 190);
    ctx.fillRect(400, 90, 140, 110);
  }).split(",")[1] ?? "";

type Chart = NonNullable<ReturnType<typeof getInstanceByDom>>;

// Kept per section because the instance id attribute that finds a chart is
// stripped once it has settled.
const settledCharts = new WeakMap<HTMLElement, Chart[]>();

/**
 * Wait for the chart to paint and finish animating, then strip echarts'
 * per-instance id (`ec_<counter>`), the one attribute that varies run to run,
 * so the archive is byte-stable.
 */
export const settleChart = async (section: HTMLElement) => {
  await expect
    .poll(() => section.querySelectorAll("svg").length)
    .toBeGreaterThanOrEqual(1);
  await settleAnimations();
  await expect.poll(() => chartsFinished(section)).toBe(true);
  const charts: Chart[] = [];
  for (const el of section.querySelectorAll<HTMLElement>(
    "[_echarts_instance_]"
  )) {
    const chart = getInstanceByDom(el);
    if (chart) {
      charts.push(chart);
    }
    el.removeAttribute("_echarts_instance_");
  }
  settledCharts.set(section, charts);
};

/**
 * Re-lay out settled charts at the width being captured. echarts sizes the SVG
 * once and only follows its container asynchronously, so without this the
 * mobile capture keeps the desktop-width chart, clipped. The width is passed
 * explicitly because a bare `resize()` keeps the size the chart was created at.
 */
export const resizeCharts = async (section: HTMLElement) => {
  const charts = settledCharts.get(section) ?? [];
  for (const chart of charts) {
    chart.resize({ width: chart.getDom().clientWidth });
    chart.getZr().refreshImmediately();
  }
  await expect
    .poll(() => charts.every((chart) => chart.getZr().animation.isFinished()))
    .toBe(true);
};
