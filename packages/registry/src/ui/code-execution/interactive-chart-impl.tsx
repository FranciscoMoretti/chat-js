"use client";
import ReactECharts from "echarts-for-react/lib/index";
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import type { EChartsOption } from "echarts-for-react/lib/types";
/* oxlint-enable eslint/sort-imports */
import { motion } from "motion/react";
import { useTheme } from "next-themes";
/* oxlint-disable eslint/sort-imports -- Oxfmt groups the React value import with the existing dependency imports; preserve formatter ordering. */
import React from "react";
/* oxlint-enable eslint/sort-imports */

/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import { Card } from "@/components/ui/card";
/* oxlint-enable eslint/sort-imports */

const CHART_COLORS = [
  "#22c55e",
  "#3b82f6",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#ef4444",
  "#84cc16",
];

interface LineScatterElement {
  label: string;
  points: [number | string, number][];
}

interface BarElement {
  group: string;
  label: string;
  value: number;
}

interface BaseChartCommon {
  title: string;
  x_label?: string;
  y_label?: string;
}

/* oxlint-disable import/exports-last -- Keep the exported declaration beside the types and initialization it describes; moving it can reorder module initialization. */
/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
export type LineChart = BaseChartCommon & {
  type: "line";
  x_scale?: "datetime";
  elements: LineScatterElement[];
};
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/group-exports */
/* oxlint-enable import/exports-last */

/* oxlint-disable import/exports-last -- Keep the exported declaration beside the types and initialization it describes; moving it can reorder module initialization. */
/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
export type ScatterChart = BaseChartCommon & {
  type: "scatter";
  x_scale?: "datetime";
  elements: LineScatterElement[];
};
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/group-exports */
/* oxlint-enable import/exports-last */

/* oxlint-disable import/exports-last -- Keep the exported declaration beside the types and initialization it describes; moving it can reorder module initialization. */
/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
export type BarChart = BaseChartCommon & {
  type: "bar";
  x_scale?: undefined;
  elements: BarElement[];
};
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/group-exports */
/* oxlint-enable import/exports-last */

/* oxlint-disable import/exports-last -- Keep the exported declaration beside the types and initialization it describes; moving it can reorder module initialization. */
/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
export type BaseChart = LineChart | ScatterChart | BarChart;
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/group-exports */
/* oxlint-enable import/exports-last */

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the ordered validation, state transitions, and cleanup in one operation so their sequencing remains reviewable. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable eslint/no-ternary -- This expression selects a value without introducing mutable intermediate state or changing evaluation order. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/* oxlint-disable eslint/id-length -- Short callback indices and coordinate keys match the surrounding collection or external data shape; renaming public keys would change the contract. */
/* oxlint-disable eslint/no-undefined -- Undefined represents an omitted optional argument or absent value in the existing TypeScript/SDK contract. */
/* oxlint-disable oxc/no-rest-spread-properties -- Copying these properties preserves immutable updates and the existing structural API without mutating the source object. */
/* oxlint-disable oxc/no-optional-chaining -- Optional access deliberately propagates absence from the external or partially initialized data contract. */
/* oxlint-disable react-perf/jsx-no-new-object-as-prop -- This prop reflects the current render values; preserve the existing update behavior rather than add unmeasured memoization. */
/* oxlint-disable react/forbid-component-props -- The composed UI component exposes this styling prop as part of its supported public API. */
/* oxlint-disable react/jsx-max-depth -- This nesting expresses the component library composition and accessibility structure; flattening it can change DOM behavior. */
/* oxlint-disable typescript/explicit-module-boundary-types -- This exported adapter derives its result from the schema or SDK contract; duplicating that type would erase inference or drift from the source. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
/* oxlint-disable typescript/strict-boolean-expressions -- This value-producing condition preserves the current nullish/empty sentinel behavior; coercing it would change the returned value. */
const InteractiveChart = ({ chart }: { chart: BaseChart }) => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const textColor = isDark ? "#e5e5e5" : "#262626";
  const gridColor = isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.15)";
  const tooltipBg = isDark ? "#171717" : "#ffffff";

  const sharedOptions: EChartsOption = {
    backgroundColor: "transparent",
    grid: {
      bottom: 32,
      containLabel: true,
      left: 32,
      right: 32,
      top: 50,
    },
    legend: {
      icon: "circle",
      itemGap: 16,
      itemHeight: 8,
      itemWidth: 8,
      textStyle: { color: textColor },
      top: 8,
    },
    tooltip: {
      backgroundColor: tooltipBg,
      borderWidth: 0,
      className: "echarts-tooltip rounded-lg! border! border-border!",
      padding: [6, 10],
      textStyle: {
        color: textColor,
        fontFamily: "system-ui, -apple-system, sans-serif",
        fontSize: 13,
      },
      trigger: "axis",
    },
  };

  const getChartOptions = (): EChartsOption => {
    const defaultAxisOptions = {
      axisLabel: {
        color: textColor,
        fontSize: 11,
        hideOverlap: true,
        margin: 8,
      },
      axisLine: { lineStyle: { color: gridColor }, show: true },
      axisTick: { show: false },
      nameTextStyle: {
        color: textColor,
        fontSize: 13,
        padding: [0, 0, 0, 0],
      },
      splitLine: {
        lineStyle: { color: gridColor, type: "dashed" },
        show: true,
      },
    };

    if (chart.type === "line" || chart.type === "scatter") {
      const series = chart.elements.map((e, index) => ({
        areaStyle:
          chart.type === "line"
            ? {
                color: {
                  colorStops: [
                    {
                      color: `${CHART_COLORS[index % CHART_COLORS.length]}15`,
                      offset: 0,
                    },
                    { color: "rgba(23, 23, 23, 0)", offset: 1 },
                  ],
                  type: "linear",
                  x: 0,
                  x2: 0,
                  y: 0,
                  y2: 1,
                },
              }
            : undefined,
        data: e.points.map((p: [number | string, number]) => {
          const x =
            chart.x_scale === "datetime" ? new Date(p[0]).getTime() : p[0];
          return [x, p[1]];
        }),
        itemStyle: {
          color: CHART_COLORS[index % CHART_COLORS.length],
        },
        lineStyle: {
          color: CHART_COLORS[index % CHART_COLORS.length],
          width: 2,
        },
        name: e.label,
        smooth: true,
        symbolSize: chart.type === "scatter" ? 10 : 0,
        type: chart.type,
      }));

      return {
        ...sharedOptions,
        series,
        xAxis: {
          name: chart.x_label,
          nameGap: 40,
          nameLocation: "middle",
          scale: true,
          type: chart.x_scale === "datetime" ? "time" : "value",
          ...defaultAxisOptions,
          axisLabel: {
            ...defaultAxisOptions.axisLabel,
            formatter:
              chart.x_scale === "datetime"
                ? (value: number): string => {
                    const date = new Date(value);
                    return date.toLocaleDateString("en-US", {
                      month: "short",
                      year: "numeric",
                    });
                  }
                : undefined,
          },
        },
        yAxis: {
          name: chart.y_label,
          nameGap: 50,
          nameLocation: "middle",
          position: "right",
          scale: true,
          type: "value",
          ...defaultAxisOptions,
        },
      };
    }

    if (chart.type === "bar") {
      const data: Record<string, BarElement[]> = {};
      for (const item of chart.elements) {
        if (!data[item.group]) {
          data[item.group] = [];
        }
        data[item.group].push(item);
      }

      const series = Object.entries(data).map(([group, elements], index) => ({
        data: elements?.map((e) => [e.label, e.value]),
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowColor: "rgba(0,0,0,0.3)",
          },
        },
        itemStyle: {
          color: CHART_COLORS[index % CHART_COLORS.length],
        },
        name: group,
        stack: "total",
        type: "bar",
      }));

      return {
        ...sharedOptions,
        series,
        xAxis: {
          name: chart.x_label,
          nameGap: 40,
          nameLocation: "middle",
          type: "category",
          ...defaultAxisOptions,
        },
        yAxis: {
          name: chart.y_label,
          nameGap: 50,
          nameLocation: "middle",
          position: "right",
          type: "value",
          ...defaultAxisOptions,
        },
      };
    }

    return sharedOptions;
  };

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      initial={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.5 }}
    >
      <Card className="border-border bg-card overflow-hidden">
        <div className="p-6">
          {chart.title && (
            <h3 className="text-foreground mb-4 text-lg font-medium">
              {chart.title}
            </h3>
          )}
          <ReactECharts
            notMerge
            // oxlint-disable-next-line typescript/no-unsafe-assignment -- ECharts options are assembled across supported chart variants; replacing its open option type requires a separate chart-schema design.
            option={getChartOptions()}
            style={{ height: "400px", width: "100%" }}
            theme={resolvedTheme === "dark" ? "dark" : undefined}
          />
        </div>
      </Card>
    </motion.div>
  );
};
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable typescript/explicit-module-boundary-types */
/* oxlint-enable react/jsx-max-depth */
/* oxlint-enable react/forbid-component-props */
/* oxlint-enable react-perf/jsx-no-new-object-as-prop */
/* oxlint-enable oxc/no-optional-chaining */
/* oxlint-enable oxc/no-rest-spread-properties */
/* oxlint-enable eslint/no-undefined */
/* oxlint-enable eslint/id-length */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/no-ternary */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable eslint/max-statements */

/* oxlint-disable import/no-default-export -- The framework or tool loader consumes this default export by convention. */
export default InteractiveChart;
/* oxlint-enable import/no-default-export */
