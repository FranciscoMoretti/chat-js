import { renderRoot, unmountRoot } from "./primitive-mount";
import { takeSnapshot } from "@uiverify/vitest";
import React from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";

import { EveToolResult } from "@/components/eve/eve-tool-result";
import { createToolError, createToolResult } from "@/lib/eve/tool-result";

import "./sandbox.css";

vi.mock("next-themes", () => ({ useTheme: () => ({ resolvedTheme: "dark" }) }));

const common = {
  input: {},
  state: "completed",
  callId: "fixture",
  type: "tool",
  kind: "tool",
  stepIndex: 0,
} as const;

test("failed research keeps validated progress alongside its error", async () => {
  document.documentElement.classList.add("dark");
  const container = document.createElement("main");
  container.style.cssText = "padding:24px;background:#171717;width:900px";
  document.body.append(container);
  const root = createRoot(container);
  try {
    await renderRoot(
      root,
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
          input: { request: "Research source evidence" },
          name: "deepResearch",
          label: "deepResearch",
        }}
      />
    );
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      "The tool did not complete."
    );
    expect(container.textContent).toContain("Search completed before failure");
    expect(container.textContent).not.toContain("Untrusted update");
    await takeSnapshot("failed-research-progress");
  } finally {
    await unmountRoot(root);
    container.remove();
  }
});

test("running research displays progress without a completed result", async () => {
  document.documentElement.classList.add("dark");
  const container = document.createElement("main");
  document.body.append(container);
  const root = createRoot(container);
  try {
    await renderRoot(
      root,
      <EveToolResult
        isReadonly
        messageId="research"
        part={{
          ...common,
          state: "running",
          input: { request: "Research source evidence" },
          name: "deepResearch",
          label: "deepResearch",
          output: createToolResult({ format: "progress" }, 0, [
            {
              type: "web",
              title: "Searching sources",
              status: "running",
              queries: ["evidence"],
              toolCallId: "fixture",
            },
          ]),
        }}
      />
    );
    expect(container.textContent).toContain("Searching sources");
    expect(container.querySelector('[role="alert"]')).toBeNull();
    await takeSnapshot("running-research-progress");
  } finally {
    await unmountRoot(root);
    container.remove();
  }
});
