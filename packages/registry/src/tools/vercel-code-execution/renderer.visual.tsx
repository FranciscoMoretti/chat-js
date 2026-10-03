import { act } from "react";
import { expect, test, vi } from "vitest";
import { page } from "vitest/browser";

import {
  barChart,
  pngBase64,
  seriesChart,
  chartDrawn,
  settleCharts,
} from "../_shared/charts";
import { captureChatStory } from "../_shared/visual";
import type { ChatState } from "../_shared/visual";
import { CodeExecution } from "./renderer";

// Use the real chart implementation instead of the dynamic (ssr:false) wrapper.
vi.mock(
  "@/tools/chatjs/_shared/code-execution/interactive-charts",
  () => import("../../ui/code-execution/interactive-chart-impl")
);
vi.mock("echarts-for-react/lib/index", async (importOriginal) => {
  const { svgECharts } = await import("../_shared/charts");
  return await svgECharts(importOriginal);
});

const code = [
  "import matplotlib.pyplot as plt",
  "",
  "plt.plot([1, 2, 3], [2, 4, 3])",
  "plt.title('Quarterly revenue')",
  "plt.show()",
].join("\n");

// Every state renders the real code editor (shiki highlights asynchronously),
// so wait for its highlighted markup before capturing.
const waitForCodeEditor = (section: HTMLElement) =>
  expect.poll(() => Boolean(section.querySelector("pre"))).toBe(true);

const settleChart = async (section: HTMLElement) => {
  await waitForCodeEditor(section);
  await chartDrawn(section);
};

const outputState = (
  label: string,
  chart: Record<string, unknown>,
  settle: (section: HTMLElement) => Promise<void>,
  toolCallId: string
): ChatState => ({
  beforeCapture: settleCharts,
  label,
  settle,
  ui: (
    <CodeExecution
      isReadonly
      messageId="code-message"
      tool={{
        input: { code, language: "python", title: "Quarterly revenue" },
        output: { chart, message: "Rendered 1 figure." },
        state: "output-available",
        toolCallId,
      }}
    />
  ),
});

test("vercel-code-execution renders every state in the chat", () =>
  captureChatStory("vercel-code-execution", [
    {
      label: "Streaming code",
      settle: async (section) => {
        await expect
          .poll(() => section.querySelector("pre code")?.textContent)
          .toBe("print(53 * 41244)");
      },
      ui: (
        <CodeExecution
          isReadonly
          messageId="code-message"
          tool={{
            input: {
              code: "print(53 * 41244)",
              language: "pyth",
              title: "Calculate 53 multiplied by 41244",
            },
            state: "input-streaming",
            toolCallId: "code-streaming",
          }}
        />
      ),
    },
    {
      label: "Running",
      settle: waitForCodeEditor,
      ui: (
        <CodeExecution
          isReadonly
          messageId="code-message"
          tool={{
            input: { code, language: "python", title: "Quarterly revenue" },
            state: "input-available",
            toolCallId: "code-running",
          }}
        />
      ),
    },
    outputState(
      "Line chart output",
      seriesChart("line", "Line chart"),
      settleChart,
      "code-line"
    ),
    outputState(
      "Scatter chart output",
      seriesChart("scatter", "Scatter chart"),
      settleChart,
      "code-scatter"
    ),
    outputState("Bar chart output", barChart, settleChart, "code-bar"),
    {
      label: "Text output",
      settle: async (section) => {
        await waitForCodeEditor(section);
        await page
          .elementLocator(section)
          .getByRole("tab", { name: "Output" })
          .click();
        await expect
          .poll(() => section.querySelector("pre code")?.textContent)
          .toBe("2185932");
      },
      ui: (
        <CodeExecution
          isReadonly
          messageId="code-message"
          tool={{
            input: {
              code: "print(53 * 41244)",
              language: "python",
              title: "Calculate 53 multiplied by 41244",
            },
            output: { chart: "", message: "2185932" },
            state: "output-available",
            toolCallId: "code-text",
          }}
        />
      ),
    },
    outputState(
      "Unreadable chart output shows only the code",
      { elements: [{ label: "bad", points: "invalid" }], type: "scatter" },
      async (section) => {
        await waitForCodeEditor(section);
        expect(
          section.querySelector("[_echarts_instance_], canvas")
        ).toBeNull();
      },
      "code-malformed"
    ),
    outputState(
      "Image output",
      { base64: pngBase64, format: "png" },
      async (section) => {
        await waitForCodeEditor(section);
        const img = section.querySelector("img");
        if (!img) {
          throw new Error("PNG output missing");
        }
        await act(async () => {
          await img.decode();
        });
      },
      "code-png"
    ),
    {
      label: "Execution failed",
      ui: (
        <CodeExecution
          isReadonly
          messageId="code-message"
          tool={{
            errorText: "The sandbox timed out after 60 seconds.",
            input: { code, language: "python", title: "Quarterly revenue" },
            state: "output-error",
            toolCallId: "code-error",
          }}
        />
      ),
    },
  ]));
