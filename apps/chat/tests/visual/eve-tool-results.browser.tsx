import { takeSnapshot } from "@uiverify/vitest";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import React, { act } from "react";
/* oxlint-enable sort-imports */
import { createRoot } from "react-dom/client";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { expect, test, vi } from "vitest";
/* oxlint-enable sort-imports */

import { EveToolResult } from "@/components/eve/eve-tool-result";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { createToolError, createToolResult } from "@/lib/eve/tool-result";
/* oxlint-enable sort-imports */
import { EveDocumentRunResult } from "@/tools/chatjs/saved-code-execution/result";
/* oxlint-disable import/no-relative-parent-imports -- ../../../../packages/registry/visual/charts-finished import: import/no-relative-parent-imports: the fixture imports its adjacent feature directly without creating a test-only alias. */

import { chartsFinished } from "../../../../packages/registry/visual/charts-finished";
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import "./sandbox.css";
/* oxlint-enable sort-imports */

/* oxlint-disable import/no-relative-parent-imports, typescript/promise-function-async -- eve-tool-results.browser route: import/no-relative-parent-imports: the fixture imports its adjacent feature directly without creating a test-only alias; typescript/promise-function-async: return the existing promise directly; adding async changes synchronous throw behavior and promise identity. */

vi.mock(
  "@/tools/chatjs/_shared/code-execution/interactive-charts",
  () =>
    import("../../tools/chatjs/_shared/code-execution/interactive-chart-impl")
);
/* oxlint-enable import/no-relative-parent-imports, typescript/promise-function-async */

/* oxlint-disable typescript/explicit-function-return-type, unicorn/no-null -- eve-tool-results.browser route: typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */
// Report documents are outside this error-receipt fixture.
vi.mock("@/components/eve/eve-document-tool", () => ({
  EveDocumentTool: () => null,
}));
/* oxlint-enable typescript/explicit-function-return-type, unicorn/no-null */

/* oxlint-disable typescript/explicit-function-return-type -- eve-tool-results.browser route: typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result. */

vi.mock("next-themes", () => ({ useTheme: () => ({ resolvedTheme: "dark" }) }));
/* oxlint-enable typescript/explicit-function-return-type */

const common = {
  input: {},
  state: "output-available",
  toolCallId: "fixture",
  type: "dynamic-tool",
} as const;
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, react-perf/jsx-no-new-object-as-prop, typescript/prefer-readonly-parameter-types -- eve-tool-results.browser route: max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; max-statements: the ordered state transitions and rendering guards belong to this cohesive feature operation; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 0); ; react-perf/jsx-no-new-object-as-prop: this prop object derives from current render state or feature styling; hoisting changes its ownership; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including chart). */

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
    // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- React act returns a runtime thenable even for the legacy synchronous overload; await it to flush updates before assertions or teardown.
    await act(() =>
      root.render(
        <div className="grid grid-cols-2 gap-6">
          {charts.map((chart, index): React.JSX.Element => (
            // oxlint-disable-next-line react/no-array-index-key -- #551: These fixed visual fixture cases are rendered once and never reordered.
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
    // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- React act returns a runtime thenable even for the legacy synchronous overload; await it to flush updates before assertions or teardown.
    await act(() => root.unmount());
    container.remove();
  }
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, react-perf/jsx-no-new-object-as-prop, typescript/prefer-readonly-parameter-types */

/* oxlint-disable max-statements, no-magic-numbers, react-perf/jsx-no-new-object-as-prop -- eve-tool-results.browser route: max-statements: the ordered state transitions and rendering guards belong to this cohesive feature operation; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 0.05); ; react-perf/jsx-no-new-object-as-prop: this prop object derives from current render state or feature styling; hoisting changes its ownership. */

test("failed research keeps validated progress alongside its error", async () => {
  document.documentElement.classList.add("dark");
  const container = document.createElement("main");
  container.style.cssText = "padding:24px;background:#171717;width:900px";
  document.body.append(container);
  const root = createRoot(container);
  try {
    // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- React act returns a runtime thenable even for the legacy synchronous overload; await it to flush updates before assertions or teardown.
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
    // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- React act returns a runtime thenable even for the legacy synchronous overload; await it to flush updates before assertions or teardown.
    await act(() => root.unmount());
    container.remove();
  }
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-statements, no-magic-numbers, react-perf/jsx-no-new-object-as-prop */

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, react-perf/jsx-no-new-object-as-prop -- eve-tool-results.browser route: max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; max-statements: the ordered state transitions and rendering guards belong to this cohesive feature operation; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 0); ; react-perf/jsx-no-new-object-as-prop: this prop object derives from current render state or feature styling; hoisting changes its ownership. */

test("installed saved-code transcript covers loading, completion and failure", async () => {
  document.documentElement.classList.add("dark");
  const container = document.createElement("main");
  container.style.cssText = "padding:24px;width:900px;background:#171717";
  document.body.append(container);
  const root = createRoot(container);
  const input = {
    documentId: "60dbe86a-b2c4-4d32-ae09-a00e90b84e99",
    revisionId: "663ccf42-10c9-453f-b9da-ebf684a6da97",
  };
  try {
    // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- React act returns a runtime thenable even for the legacy synchronous overload; await it to flush updates before assertions or teardown.
    await act(() =>
      root.render(
        <div className="grid gap-6">
          <EveToolResult
            isReadonly
            messageId="saved-code"
            part={{
              ...common,
              input,
              state: "input-available",
              toolName: "runCodeDocument",
            }}
          />
          <EveToolResult
            isReadonly
            messageId="saved-code"
            part={{
              ...common,
              input,
              output: createToolResult(
                { ...input, chart: "", message: "Saved revision completed" },
                0
              ),
              toolName: "runCodeDocument",
            }}
          />
          <EveToolResult
            isReadonly
            messageId="saved-code"
            part={{
              ...common,
              input,
              output: createToolError(0),
              toolName: "runCodeDocument",
            }}
          />
        </div>
      )
    );
    expect(container.textContent).toContain("Running saved code");
    expect(container.textContent).toContain("Saved revision completed");
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "The tool did not complete"
    );
    await takeSnapshot("installed-saved-code-transcript");
  } finally {
    // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- React act returns a runtime thenable even for the legacy synchronous overload; await it to flush updates before assertions or teardown.
    await act(() => root.unmount());
    container.remove();
  }
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, react-perf/jsx-no-new-object-as-prop */
