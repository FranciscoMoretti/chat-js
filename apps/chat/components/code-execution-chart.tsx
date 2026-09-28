"use client";

import Image from "next/image";
import { z } from "zod";

import InteractiveChart from "./interactive-charts";
import type { BaseChart } from "./interactive-charts";

const chartLabels = {
  title: z.string().default(""),
  x_label: z.string().optional(),
  y_label: z.string().optional(),
};
const series = z.array(
  z.object({
    label: z.string(),
    points: z.array(z.tuple([z.union([z.number(), z.string()]), z.number()])),
  })
);
const chartSchema = z.discriminatedUnion("type", [
  z.object({
    ...chartLabels,
    elements: series,
    type: z.literal("line"),
    x_scale: z
      .literal("datetime")
      .nullish()
      .transform((value) => value ?? undefined),
  }),
  z.object({
    ...chartLabels,
    elements: series,
    type: z.literal("scatter"),
    x_scale: z
      .literal("datetime")
      .nullish()
      .transform((value) => value ?? undefined),
  }),
  z.object({
    ...chartLabels,
    elements: z.array(
      z.object({ group: z.string(), label: z.string(), value: z.number() })
    ),
    type: z.literal("bar"),
  }),
]);
const pngSchema = z.object({
  base64: z.string().min(1),
  format: z.literal("png"),
});

export const CodeExecutionChart = ({ value }: { value: unknown }) => {
  const parsedChart = chartSchema.safeParse(value);
  const chart: BaseChart | null = parsedChart.success ? parsedChart.data : null;
  const parsedPng = pngSchema.safeParse(value);
  const pngChart = parsedPng.success ? parsedPng.data : null;
  return (
    <>
      {chart && (
        <div className="pt-1">
          <InteractiveChart chart={chart} />
        </div>
      )}

      {pngChart && (
        <div className="relative aspect-[4/3] w-full">
          <Image
            alt="Chart output"
            className="rounded-lg object-contain"
            fill
            sizes="(max-width: 768px) 100vw, 768px"
            src={`data:image/png;base64,${pngChart.base64}`}
            unoptimized
          />
        </div>
      )}
    </>
  );
};
