import { renderRoot, unmountRoot } from "./primitive-mount";
import "./sandbox.css";
import { takeSnapshot } from "@uiverify/vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test } from "vitest";
import { page } from "vitest/browser";

import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import { ReasonSearchResearchProgress } from "@/chatjs/tools/deep-research/progress";
import { ResearchTasks } from "@/chatjs/tools/deep-research/tasks";
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

const activeUpdates = updates.filter(
  (update: ReadonlyNativeSurface<ResearchUpdate>) => update.type !== "completed"
);

const workflowStarted: ResearchUpdate = {
  timestamp: 1,
  title: "Research started",
  toolCallId: "workflow",
  type: "started",
};
const childSearch: ResearchUpdate = {
  queries: ["independent search"],
  status: "running",
  title: "Searching the web",
  toolCallId: "child-search",
  type: "web",
};
const workflowThought: ResearchUpdate = {
  message: "Researching another topic.",
  status: "running",
  title: "Researching topic",
  toolCallId: "workflow",
  type: "thoughts",
};
const workflowWithSearch: ResearchUpdate[] = [workflowStarted, childSearch];
const workflowAfterAnotherUpdate: ResearchUpdate[] = [
  workflowStarted,
  workflowThought,
  childSearch,
];
type SearchRowContainer = Readonly<Pick<ParentNode, "querySelectorAll">>;
const findSearchRow = (container: SearchRowContainer): Element => {
  for (const row of container.querySelectorAll(".group")) {
    if ((row.textContent ?? "").includes("independent search")) {
      return row;
    }
  }
  throw new Error("The child search row was not rendered.");
};

test("research task progress renders its update states together", async () => {
  document.documentElement.classList.add("dark");
  const container = document.createElement("main");
  container.style.cssText = "padding:24px;width:860px;background:#171717";
  document.body.append(container);
  const root = createRoot(container);

  try {
    await renderRoot(root, <ResearchTasks updates={updates} />);
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

    await renderRoot(
      root,
      <div className="grid gap-4">
        <section aria-label="Research in progress">
          <ReasonSearchResearchProgress updates={activeUpdates} />
        </section>
        <section aria-label="Completed research">
          <ReasonSearchResearchProgress updates={updates} />
        </section>
      </div>
    );
    await expect
      .poll(() => container.textContent)
      .toContain("Writing the answer");
    await expect
      .poll(() => container.textContent)
      .toContain("Researched for 0 seconds");
    const completedPanel = container.querySelector(
      '[aria-label="Completed research"] button'
    );
    if (!(completedPanel instanceof HTMLButtonElement)) {
      throw new Error("Completed research progress control was not rendered.");
    }
    await act(async () => {
      await page.elementLocator(completedPanel).click();
    });
    await expect
      .poll(() => container.textContent)
      .toContain("Research complete");
    await expect
      .poll(
        () =>
          container.querySelectorAll(
            '[aria-label="Completed research"] .group > div[style*="opacity: 1"]'
          ).length
      )
      .toBe(updates.length);
    await expect
      .poll(() =>
        [
          ...container.querySelectorAll<HTMLElement>('div[style*="opacity"]'),
        ].every((element) => getComputedStyle(element).opacity === "1")
      )
      .toBe(true);
    await takeSnapshot("research-progress-active-and-complete");
  } finally {
    await unmountRoot(root);
    container.remove();
  }
});

test("search rows keep identity when workflow updates append", async () => {
  const container = document.createElement("main");
  const root = createRoot(container);
  try {
    await renderRoot(root, <ResearchTasks updates={workflowWithSearch} />);
    const initialSearchRow = findSearchRow(container);

    await renderRoot(
      root,
      <ResearchTasks updates={workflowAfterAnotherUpdate} />
    );
    const updatedSearchRow = findSearchRow(container);
    expect(updatedSearchRow).toBe(initialSearchRow);
  } finally {
    await unmountRoot(root);
    container.remove();
  }
});
