import "./sandbox.css";
import { takeSnapshot } from "@uiverify/vitest";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import React, { act } from "react";
/* oxlint-enable sort-imports */
import { createRoot } from "react-dom/client";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { expect, test } from "vitest";
/* oxlint-enable sort-imports */

import { ResearchTasks } from "@/tools/chatjs/deep-research/tasks";
import type { ResearchUpdate } from "@/tools/platform/research-updates-schema";

const updates: ResearchUpdate[] = [
  {
    timestamp: 1,
    title: "Research started",
    toolCallId: "started",
    type: "started",
  },
  {
    queries: ["distributed systems consistency"],
    status: "running",
    title: "Searching the web",
    toolCallId: "running",
    type: "web",
  },
  {
    queries: ["distributed systems consistency"],
    results: [
      {
        content: "A source about consistency models.",
        source: "web",
        title: "Consistency models",
        url: "https://example.test/consistency",
      },
    ],
    status: "completed",
    title: "Search complete",
    toolCallId: "completed",
    type: "web",
  },
  {
    message: "Comparing the evidence across sources.",
    status: "completed",
    title: "Research thoughts",
    toolCallId: "thoughts",
    type: "thoughts",
  },
  {
    message: "The sources agree on the main tradeoff.",
    status: "completed",
    title: "Writing the answer",
    toolCallId: "writing",
    type: "writing",
  },
  {
    timestamp: 2,
    title: "Research complete",
    toolCallId: "finished",
    type: "completed",
  },
];

/* oxlint-disable max-statements, oxc/no-async-await -- One visual fixture lifecycle mounts progress states, waits for motion to settle, captures, and unmounts in order. */
test("research task progress renders its update states together", async () => {
  document.documentElement.classList.add("dark");
  const container = document.createElement("main");
  container.style.cssText = "padding:24px;width:860px;background:#171717";
  document.body.append(container);
  const root = createRoot(container);

  try {
    // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- React act returns a runtime thenable; await it to flush rendering before assertions and capture.
    await act(() => root.render(<ResearchTasks updates={updates} />));
    await expect
      .poll(() => container.textContent)
      .toContain("Research complete");
    await expect
      .poll(
        () =>
          container.querySelectorAll('.group > div[style*="opacity: 1"]').length
      )
      .toBe(updates.length);
    await takeSnapshot("research-task-progress-states");
  } finally {
    // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- React act returns a runtime thenable; await it to flush unmount before teardown.
    await act(() => root.unmount());
    container.remove();
  }
});
/* oxlint-enable max-statements, oxc/no-async-await */
