/* oxlint-disable eslint/max-lines-per-function -- A story lists every renderer state in one capture call, so its length grows with the states it covers. */
/* oxlint-disable eslint/max-params -- The state builder takes exactly the fields that vary between states. */
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
/* oxlint-disable import/no-relative-parent-imports -- Stories import the shared harness from the sibling _shared directory. */
/* oxlint-disable oxc/no-async-await -- Captures await rendering, fonts and animations in a fixed order. */
/* oxlint-disable oxc/no-rest-spread-properties -- Copying these properties preserves immutable updates and the existing structural API without mutating the source object. */
/* oxlint-disable react-perf/jsx-no-new-object-as-prop -- Each story renders once per capture; memoizing fixture props would only add noise. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- Parameters are DOM elements and library props, which are mutable host objects. */
/* oxlint-disable typescript/promise-function-async -- Test and settle callbacks return the capture promise directly. */

import React, { act } from "react";
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
  return await svgECharts(importOriginal);
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
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable react-perf/jsx-no-new-object-as-prop */
/* oxlint-enable oxc/no-rest-spread-properties */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-enable eslint/sort-imports */
/* oxlint-enable eslint/max-params */
/* oxlint-enable eslint/max-lines-per-function */
