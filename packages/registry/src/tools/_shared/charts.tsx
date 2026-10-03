/* oxlint-disable eslint/max-statements -- Capture steps run in a fixed order (render, settle, resize, snapshot); splitting them hides that sequence. */
/* oxlint-disable eslint/no-magic-numbers -- Fixture values, viewport widths and canvas sizes are literal test data. */
/* oxlint-disable eslint/no-ternary -- This expression selects a value without introducing mutable intermediate state or changing evaluation order. */
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
/* oxlint-disable import/group-exports -- Each helper is exported where it is declared, next to its documentation. */
/* oxlint-disable import/no-named-export -- Stories import the harness helpers by name. */
/* oxlint-disable import/no-namespace -- The type-only namespace import names the module the mock replaces. */
/* oxlint-disable jsdoc/require-param -- The comment explains why; the TypeScript signature describes the parameters. */
/* oxlint-disable jsdoc/require-returns -- The comment explains why; the TypeScript signature describes the result. */
/* oxlint-disable oxc/no-async-await -- Captures await rendering, fonts and animations in a fixed order. */
/* oxlint-disable oxc/no-optional-chaining -- Optional access deliberately propagates absence from the external or partially initialized data contract. */
/* oxlint-disable oxc/no-rest-spread-properties -- Copying these properties preserves immutable updates and the existing structural API without mutating the source object. */
/* oxlint-disable react-perf/jsx-no-new-function-as-prop -- Each story renders once per capture; memoizing callbacks would only add noise. */
/* oxlint-disable react-perf/jsx-no-new-object-as-prop -- Each story renders once per capture; memoizing fixture props would only add noise. */
/* oxlint-disable react/jsx-props-no-spreading -- The chart mock forwards every prop to the real component. */
/* oxlint-disable typescript/explicit-function-return-type -- Return types are inferred from the fixtures and helpers they wrap. */
/* oxlint-disable typescript/explicit-module-boundary-types -- Return types are inferred from the fixtures and helpers they wrap. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- Parameters are DOM elements and library props, which are mutable host objects. */
/* oxlint-disable typescript/promise-function-async -- Test and settle callbacks return the capture promise directly. */

import type * as EChartsForReact from "echarts-for-react/lib/index";
import type {
  EChartsInstance,
  EChartsReactProps,
} from "echarts-for-react/lib/types";
import React from "react";
import { expect } from "vitest";

import { makeCanvasDataUri, settleAnimations } from "./visual";

// The chart echarts-for-react settled on for each element, via `onChartReady`.
const readyCharts = new WeakMap<HTMLElement, EChartsInstance>();

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
      onChartReady={(chart) => {
        readyCharts.set(chart.getDom(), chart);
        props.onChartReady?.(chart);
      }}
      opts={{ ...props.opts, renderer: "svg" }}
      // oxlint-disable-next-line typescript/no-unsafe-assignment -- echarts-for-react types `option` as any.
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

/** Settle for a state that shows a chart: wait until echarts has drawn it. */
export const chartDrawn = (section: HTMLElement) =>
  expect
    .poll(() => section.querySelector(".echarts-for-react svg"))
    .not.toBeNull();

/**
 * Bring every chart in the section to its final frame at the current width;
 * run it before each capture. echarts-for-react builds the chart
 * asynchronously and fixes its width at creation, so wait for it and resize
 * it to its container. Its instance id (`ec_<counter>`), the one attribute
 * that varies run to run, is stripped so the archive is byte-stable.
 */
export const settleCharts = async (section: HTMLElement) => {
  const elements = [
    ...section.querySelectorAll<HTMLElement>(".echarts-for-react"),
  ];
  const ready = () =>
    elements.flatMap((el) => {
      const chart = readyCharts.get(el);
      return chart ? [chart] : [];
    });
  await expect.poll(() => ready().length).toBe(elements.length);
  const charts = ready();
  for (const chart of charts) {
    const el = chart.getDom();
    el.removeAttribute("_echarts_instance_");
    chart.resize({ width: el.clientWidth });
    chart.getZr().refreshImmediately();
  }
  await settleAnimations();
  await expect
    .poll(() => charts.every((chart) => chart.getZr().animation.isFinished()))
    .toBe(true);
};
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable typescript/explicit-module-boundary-types */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable react/jsx-props-no-spreading */
/* oxlint-enable react-perf/jsx-no-new-object-as-prop */
/* oxlint-enable react-perf/jsx-no-new-function-as-prop */
/* oxlint-enable oxc/no-rest-spread-properties */
/* oxlint-enable oxc/no-optional-chaining */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable jsdoc/require-returns */
/* oxlint-enable jsdoc/require-param */
/* oxlint-enable import/no-namespace */
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/group-exports */
/* oxlint-enable eslint/sort-imports */
/* oxlint-enable eslint/no-ternary */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/max-statements */
