"use client";

import type { UIToolInvocation } from "ai";
import InteractiveChart, {
  type BaseChart,
} from "@/components/interactive-charts";
import { SandboxComposed } from "@/components/sandbox";
import type { codeExecution } from "./tool";

export type CodeExecutionTool = UIToolInvocation<typeof codeExecution>;

function isBaseChart(input: unknown): input is BaseChart {
  if (typeof input !== "object" || input === null) {
    return false;
  }
  const maybe = input as Record<string, unknown>;
  const hasType = typeof maybe.type === "string";
  const hasTitle =
    typeof maybe.title === "string" || typeof maybe.title === "undefined";
  const hasElements = Array.isArray(maybe.elements);
  return hasType && hasTitle && hasElements;
}

interface PngChart {
  base64: string;
  format: string;
}

function isPngChart(input: unknown): input is PngChart {
  if (typeof input !== "object" || input === null) {
    return false;
  }
  const maybe = input as Record<string, unknown>;
  return typeof maybe.base64 === "string" && maybe.base64.length > 0;
}

export function CodeExecution({ tool }: { tool: CodeExecutionTool }) {
  const args = tool.input ?? {
    code: "",
    title: "",
    language: "python",
    icon: "default",
  };
  const result = tool.state === "output-available" ? tool.output : null;
  const chart: BaseChart | null =
    result && isBaseChart(result.chart) ? result.chart : null;
  const pngChart: PngChart | null =
    result && isPngChart(result.chart) ? result.chart : null;
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
        <div className="pt-1">
          {/* biome-ignore lint/performance/noImgElement: Next/Image not desired for base64 data URLs */}
          {/* biome-ignore lint/correctness/useImageSize: Dynamic chart dimensions unknown */}
          <img
            alt="Chart output"
            className="max-w-full rounded-lg"
            src={`data:image/png;base64,${pngChart.base64}`}
          />
        </div>
      )}
    </div>
  );
}
