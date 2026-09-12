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
      top: 50,
      right: 32,
      bottom: 32,
      left: 32,
      containLabel: true,
    },
    legend: {
      textStyle: { color: textColor },
      top: 8,
      icon: "circle",
      itemWidth: 8,
      itemHeight: 8,
      itemGap: 16,
    },
    tooltip: {
      trigger: "axis",
      backgroundColor: tooltipBg,
      borderWidth: 0,
      padding: [6, 10],
      className: "echarts-tooltip rounded-lg! border! border-border!",
      textStyle: {
        color: textColor,
        fontSize: 13,
        fontFamily: "system-ui, -apple-system, sans-serif",
      },
    },
  };

  const getChartOptions = (): EChartsOption => {
    const defaultAxisOptions = {
      axisLine: { show: true, lineStyle: { color: gridColor } },
      axisTick: { show: false },
      axisLabel: {
        color: textColor,
        margin: 8,
        fontSize: 11,
        hideOverlap: true,
      },
      nameTextStyle: {
        color: textColor,
        fontSize: 13,
        padding: [0, 0, 0, 0],
      },
      splitLine: {
        show: true,
        lineStyle: { color: gridColor, type: "dashed" },
      },
    };

    if (chart.type === "line" || chart.type === "scatter") {
      const series = chart.elements.map((e, index) => ({
        name: e.label,
        type: chart.type,
        data: e.points.map((p: [number | string, number]) => {
          const x =
            chart.x_scale === "datetime" ? new Date(p[0]).getTime() : p[0];
          return [x, p[1]];
        }),
        smooth: true,
        symbolSize: chart.type === "scatter" ? 10 : 0,
        lineStyle: {
          width: 2,
          color: CHART_COLORS[index % CHART_COLORS.length],
        },
        itemStyle: {
          color: CHART_COLORS[index % CHART_COLORS.length],
        },
        areaStyle:
          chart.type === "line"
            ? {
                color: {
                  type: "linear",
                  x: 0,
                  y: 0,
                  x2: 0,
                  y2: 1,
                  colorStops: [
                    {
                      offset: 0,
                      color: `${CHART_COLORS[index % CHART_COLORS.length]}15`,
                    },
                    { offset: 1, color: "rgba(23, 23, 23, 0)" },
                  ],
                },
              }
            : undefined,
      }));

      return {
        ...sharedOptions,
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
          type: "value",
          name: chart.y_label,
          nameLocation: "middle",
          nameGap: 50,
          position: "right",
          scale: true,
          ...defaultAxisOptions,
        },
        series,
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
        name: group,
        type: "bar",
        stack: "total",
        data: elements?.map((e) => [e.label, e.value]),
        itemStyle: {
          color: CHART_COLORS[index % CHART_COLORS.length],
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowColor: "rgba(0,0,0,0.3)",
          },
        },
      }));

      return {
        ...sharedOptions,
        xAxis: {
          type: "category",
          name: chart.x_label,
          nameLocation: "middle",
          nameGap: 40,
          ...defaultAxisOptions,
        },
        yAxis: {
          type: "value",
          name: chart.y_label,
          nameLocation: "middle",
          nameGap: 50,
          position: "right",
          ...defaultAxisOptions,
        },
        series,
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
