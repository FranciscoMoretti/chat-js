import { takeSnapshot } from "@uiverify/vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";

import { EveToolResult } from "@/components/eve/eve-tool-result";
import { createToolError, createToolResult } from "@/lib/eve/tool-result";
import { EveDocumentRunResult } from "@/tools/chatjs/saved-code-execution/result";

import { chartsFinished } from "../../../../packages/registry/visual/charts-finished";

import "./sandbox.css";

vi.mock(
  "@/tools/chatjs/_shared/code-execution/interactive-charts",
  () =>
    import("../../tools/chatjs/_shared/code-execution/interactive-chart-impl")
);
// Report documents are outside this error-receipt fixture.
vi.mock("@/components/eve/eve-document-tool", () => ({
  EveDocumentTool: () => null,
}));

vi.mock("next-themes", () => ({ useTheme: () => ({ resolvedTheme: "dark" }) }));

const common = {
  input: {},
  state: "output-available",
  toolCallId: "fixture",
  type: "dynamic-tool",
} as const;

test("saved-code results display interactive and PNG charts with text fallback", async () => {
  document.documentElement.classList.add("dark");
  const container = document.createElement("main");
  container.style.cssText = "padding:24px;background:#171717;width:900px";
  document.body.append(container);
  const root = createRoot(container);
  const canvas = document.createElement("canvas");
  canvas.width = 600;
  canvas.height = 200;
  const drawing = canvas.getContext("2d");
  if (!drawing) {
    throw new Error("Canvas unavailable");
  }
  drawing.fillStyle = "#e5e7eb";
  drawing.fillRect(0, 0, 600, 200);
  drawing.fillStyle = "#2563eb";
  drawing.fillRect(40, 60, 160, 140);
  drawing.fillRect(260, 20, 160, 180);
  const charts = [
    {
      elements: [
        { group: "Counts", label: "A", value: 3 },
        { group: "Counts", label: "B", value: 5 },
      ],
      title: "Saved analysis",
      type: "bar",
    },
    {
      base64: canvas.toDataURL().split(",")[1],
      format: "png",
    },
    "",
  ];
  try {
    await act(() =>
      root.render(
        <div className="grid grid-cols-2 gap-6">
          {charts.map((chart, index) => (
            <section key={index}>
              <EveDocumentRunResult
                part={{
                  ...common,
                  output: createToolResult(
                    { chart, message: `Result ${index + 1}` },
                    0
                  ),
                  toolName: "runCodeDocument",
                }}
              />
            </section>
          ))}
        </div>
      )
    );
    await expect.poll(() => container.querySelector("canvas")).not.toBeNull();
    expect(container.querySelector('img[alt="Chart output"]')).not.toBeNull();
    expect(container.textContent).toContain("Result 3");
    await expect
      .poll(() => {
        const heading = container.querySelector("h3");
        const panel = heading?.parentElement?.parentElement?.parentElement;
        return panel && getComputedStyle(panel).opacity === "1";
      })
      .toBe(true);
    await expect.poll(() => chartsFinished(container)).toBe(true);
    const image = container.querySelector("img");
    if (!image) {
      throw new Error("PNG output missing");
    }
    await image.decode();
    await takeSnapshot("saved-code-charts");
  } finally {
    await act(() => root.unmount());
    container.remove();
  }
});

test("failed research keeps validated progress alongside its error", async () => {
  document.documentElement.classList.add("dark");
  const container = document.createElement("main");
  container.style.cssText = "padding:24px;background:#171717;width:900px";
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(() =>
      root.render(
        <EveToolResult
          isReadonly
          messageId="research"
          part={{
            ...common,
            output: createToolError(0.05, [
              {
                queries: ["test evidence"],
                status: "completed",
                title: "Search completed before failure",
                toolCallId: "fixture",
                type: "web",
              },
              { title: "Untrusted update", type: "invalid" },
            ]),
            toolName: "deepResearch",
          }}
        />
      )
    );
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      "The tool did not complete."
    );
    expect(container.textContent).toContain("Search completed before failure");
    expect(container.textContent).not.toContain("Untrusted update");
    await takeSnapshot("failed-research-progress");
  } finally {
    await act(() => root.unmount());
    container.remove();
  }
});
