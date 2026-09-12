"use client";

import ReactECharts from "echarts-for-react/lib/index";
import type { EChartsOption } from "echarts-for-react/lib/types";
import { motion } from "motion/react";
import { useTheme } from "next-themes";

import { Card } from "@/components/ui/card";

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

export type LineChart = BaseChartCommon & {
  type: "line";
  x_scale?: "datetime";
  elements: LineScatterElement[];
};

export type ScatterChart = BaseChartCommon & {
  type: "scatter";
  x_scale?: "datetime";
  elements: LineScatterElement[];
};

export type BarChart = BaseChartCommon & {
  type: "bar";
  x_scale?: undefined;
  elements: BarElement[];
};

export type BaseChart = LineChart | ScatterChart | BarChart;

const InteractiveChart = ({ chart }: { chart: BaseChart }) => {
  const { resolvedTheme } = useTheme();
  const textColor = "#e5e5e5";
  const gridColor = "rgba(255, 255, 255, 0.1)";
  const tooltipBg = "#171717";

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
          type: chart.x_scale === "datetime" ? "time" : "value",
          name: chart.x_label,
          nameLocation: "middle",
          nameGap: 40,
          scale: true,
          ...defaultAxisOptions,
          axisLabel: {
            ...defaultAxisOptions.axisLabel,
            formatter:
              chart.x_scale === "datetime"
                ? (value: number) => {
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
      const data = chart.elements.reduce(
        (acc: Record<string, BarElement[]>, item) => {
          const key = item.group;
          if (!acc[key]) {
            acc[key] = [];
          }
          acc[key].push(item);
          return acc;
        },
        {}
      );

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
            notMerge={true}
            option={getChartOptions()}
            style={{ height: "400px", width: "100%" }}
            theme={resolvedTheme === "dark" ? "dark" : undefined}
          />
        </div>
      </Card>
    </motion.div>
  );
};

export default InteractiveChart;
