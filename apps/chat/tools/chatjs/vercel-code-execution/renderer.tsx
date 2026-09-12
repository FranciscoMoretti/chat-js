"use client";

import type { UIToolInvocation } from "ai";
import Image from "next/image";
import { z } from "zod";

import InteractiveChart from "@/components/interactive-charts";
import type { BaseChart } from "@/components/interactive-charts";
import { SandboxComposed } from "@/components/sandbox";

import type { codeExecution } from "./tool";

export type CodeExecutionTool = UIToolInvocation<typeof codeExecution>;

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
    type: z.literal("line"),
    x_scale: z.literal("datetime").optional(),
    elements: series,
  }),
  z.object({
    ...chartLabels,
    type: z.literal("scatter"),
    x_scale: z.literal("datetime").optional(),
    elements: series,
  }),
  z.object({
    ...chartLabels,
    type: z.literal("bar"),
    elements: z.array(
      z.object({ group: z.string(), label: z.string(), value: z.number() })
    ),
  }),
]);
const pngSchema = z.object({
  base64: z.string().min(1),
  format: z.literal("png"),
});

export function CodeExecution({ tool }: { tool: CodeExecutionTool }) {
  const args = tool.input ?? {
    code: "",
    title: "",
    language: "python",
    icon: "default",
  };
  const result = tool.state === "output-available" ? tool.output : null;
  const parsedChart = chartSchema.safeParse(result?.chart);
  const chart: BaseChart | null = parsedChart.success ? parsedChart.data : null;
  const parsedPng = pngSchema.safeParse(result?.chart);
  const pngChart = parsedPng.success ? parsedPng.data : null;
  const code = typeof args.code === "string" ? args.code : "";
  const title = typeof args.title === "string" ? args.title : "";
  const language = args.language === "javascript" ? "javascript" : "python";
  return (
    <div className="space-y-6">
      <SandboxComposed
        code={code}
        language={language}
        output={result?.message}
        state={tool.state}
        title={title}
      />

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
    </div>
  );
}
