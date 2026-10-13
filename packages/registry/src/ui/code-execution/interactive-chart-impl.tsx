"use client";
import type {
  BarSeriesOption,
  EChartsOption,
  LineSeriesOption,
  ScatterSeriesOption,
} from "echarts";
import { Card } from "@/components/ui/card";
import React from "react";
import ReactECharts from "echarts-for-react/lib/index";
import { motion } from "motion/react";
import { useTheme } from "next-themes";

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
  readonly label: string;
  readonly points: readonly (readonly [number | string, number])[];
}

interface BarElement {
  readonly group: string;
  readonly label: string;
  readonly value: number;
}

interface BaseChartCommon {
  readonly title: string;
  readonly x_label?: string;
  readonly y_label?: string;
}

type LineChart = BaseChartCommon & {
  readonly type: "line";
  readonly x_scale?: "datetime";
  readonly elements: readonly LineScatterElement[];
};

type ScatterChart = BaseChartCommon & {
  readonly type: "scatter";
  readonly x_scale?: "datetime";
  readonly elements: readonly LineScatterElement[];
};

type BarChart = BaseChartCommon & {
  readonly type: "bar";
  readonly x_scale?: undefined;
  readonly elements: readonly BarElement[];
};

type BaseChart = LineChart | ScatterChart | BarChart;

const InteractiveChart = ({
  chart,
}: {
  readonly chart: BaseChart;
}): React.JSX.Element => {
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
    } satisfies NonNullable<EChartsOption["xAxis"]>;

    if (chart.type === "line" || chart.type === "scatter") {
      const series = chart.elements.map(
        (element, index): LineSeriesOption | ScatterSeriesOption => ({
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
          data: element.points.map(
            (point: readonly [number | string, number]) => {
              const horizontalValue =
                chart.x_scale === "datetime"
                  ? new Date(point[0]).getTime()
                  : point[0];
              return [horizontalValue, point[1]];
            }
          ),
          itemStyle: {
            color: CHART_COLORS[index % CHART_COLORS.length],
          },
          lineStyle: {
            color: CHART_COLORS[index % CHART_COLORS.length],
            width: 2,
          },
          name: element.label,
          smooth: true,
          symbolSize: chart.type === "scatter" ? 10 : 0,
          type: chart.type,
        })
      );

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
        const existingGroup = data[item.group];
        if (existingGroup === undefined) {
          data[item.group] = [];
        }
        data[item.group].push(item);
      }

      const series = Object.entries(data).map(
        (
          [group, elements]: readonly [string, readonly BarElement[]],
          index
        ): BarSeriesOption => ({
          data: elements.map((element: Readonly<BarElement>) => [
            element.label,
            element.value,
          ]),
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
        })
      );

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
            option={getChartOptions()}
            style={{ height: "400px", width: "100%" }}
            theme={resolvedTheme === "dark" ? "dark" : undefined}
          />
        </div>
      </Card>
    </motion.div>
  );
};

export type { BarChart, BaseChart, LineChart, ScatterChart };
export default InteractiveChart;
