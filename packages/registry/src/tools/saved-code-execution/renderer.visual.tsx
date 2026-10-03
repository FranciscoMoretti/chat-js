import { act } from "react";
import { test, vi } from "vitest";

import {
  barChart,
  pngBase64,
  seriesChart,
  chartDrawn,
  settleCharts,
} from "../_shared/charts";
import { captureChatStory } from "../_shared/visual";
import type { ChatState } from "../_shared/visual";
import { SavedCodeRenderer } from "./renderer";

// Use the real chart implementation instead of the dynamic (ssr:false) wrapper.
vi.mock(
  "@/tools/chatjs/_shared/code-execution/interactive-charts",
  () => import("../../ui/code-execution/interactive-chart-impl")
);
vi.mock("echarts-for-react/lib/index", async (importOriginal) => {
  const { svgECharts } = await import("../_shared/charts");
  return svgECharts(importOriginal);
});

const savedDocument = {
  documentId: "5b8e1f2a-3c4d-4e5f-9a6b-7c8d9e0f1a2b",
  revisionId: "9c0d1e2f-3a4b-4c5d-8e6f-7a8b9c0d1e2f",
};

const output = (
  label: string,
  chart: unknown,
  message: string,
  settle?: ChatState["settle"]
): ChatState => ({
  beforeCapture: settleCharts,
  label,
  settle,
  ui: (
    <SavedCodeRenderer
      isReadonly
      messageId="saved-code-message"
      tool={{
        input: savedDocument,
        output: { ...savedDocument, chart, message },
        state: "output-available",
        toolCallId: `saved-code-${label}`,
      }}
    />
  ),
});

test("saved-code-execution renders every state in the chat", () =>
  captureChatStory("saved-code-execution", [
    {
      label: "Running",
      ui: (
        <SavedCodeRenderer
          isReadonly
          messageId="saved-code-message"
          tool={{
            input: savedDocument,
            state: "input-available",
            toolCallId: "saved-code-running",
          }}
        />
      ),
    },
    output("Text output", "", "Total revenue: 15"),
    output(
      "Line chart output",
      seriesChart("line", "Weekly signups"),
      "Rendered 1 chart.",
      chartDrawn
    ),
    output("Bar chart output", barChart, "Rendered 1 chart.", chartDrawn),
    output(
      "Image output",
      { base64: pngBase64, format: "png" },
      "Rendered 1 figure.",
      async (section) => {
        const img = section.querySelector("img");
        if (!img) {
          throw new Error("PNG output missing");
        }
        await act(async () => {
          await img.decode();
        });
      }
    ),
    {
      label: "Run failed",
      ui: (
        <SavedCodeRenderer
          isReadonly
          messageId="saved-code-message"
          tool={{
            errorText: "NameError: name 'revenue' is not defined",
            input: savedDocument,
            state: "output-error",
            toolCallId: "saved-code-failed",
          }}
        />
      ),
    },
  ]));
