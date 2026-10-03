import { act } from "react";
import { expect, test, vi } from "vitest";

import { ArtifactProvider } from "@/hooks/use-artifact";
import type * as UrlUtils from "@/lib/url-utils";
import type { ResearchUpdate } from "@/tools/platform/research-updates-schema";

import { captureChatStory } from "../_shared/visual";
import { faviconDataUri } from "../_shared/web-search";
import { DeepResearchRenderer } from "./renderer";

// Serve an inline favicon so source badges don't capture as broken images.
vi.mock("@/lib/url-utils", async (importOriginal) => ({
  ...(await importOriginal<typeof UrlUtils>()),
  getFaviconUrl: () => faviconDataUri,
}));

const toolCallId = "deep-research";
const messageId = "deep-research-message";

const started: ResearchUpdate = {
  timestamp: 0,
  title: "Planning the research",
  toolCallId,
  type: "started",
};

const searching: ResearchUpdate[] = [
  started,
  {
    queries: ["espresso grinder burr size", "flat vs conical burrs"],
    status: "running",
    title: "Searching for grinder comparisons",
    toolCallId,
    type: "web",
  },
];

const finished: ResearchUpdate[] = [
  started,
  {
    queries: ["espresso grinder burr size", "flat vs conical burrs"],
    results: [
      {
        content: "Larger flat burrs produce a narrower particle distribution.",
        source: "web",
        title: "Flat vs conical burrs, measured",
        url: "https://coffeeadastra.com/burr-comparison",
      },
      {
        content: "Burr geometry matters less than alignment for home grinders.",
        source: "web",
        title: "Grinder alignment explained",
        url: "https://www.home-barista.com/alignment",
      },
      {
        content: "Particle size distributions across 12 commercial grinders.",
        source: "academic",
        title: "Grind size distribution in espresso",
        url: "https://arxiv.org/abs/2402.04521",
      },
    ],
    status: "completed",
    title: "Searching for grinder comparisons",
    toolCallId,
    type: "web",
  },
  {
    message:
      "Alignment and burr size both matter; the sources disagree on which matters more below 64mm.",
    status: "completed",
    title: "Comparing the findings",
    toolCallId,
    type: "thoughts",
  },
  {
    message: "Drafting the report with a buying guide by budget.",
    status: "completed",
    title: "Writing the report",
    toolCallId,
    type: "writing",
  },
  { timestamp: 42_000, title: "Done", toolCallId, type: "completed" },
];

const report = {
  date: "2026-09-30T12:00:00.000Z",
  documentId: "3f1c2a9e-8b4d-4c6e-9f2a-1b3c4d5e6f70",
  format: "report",
  kind: "text",
  result: "Report created.",
  revisionId: "7a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d",
  status: "success",
  title: "Choosing an espresso grinder",
};

// Each research step's icon column is content-height (the row stretches it to
// the step's text) and its dashed connector is `flex-1` inside it. The archive
// replays this subtree without the stretch that gave the column a definite
// height, so the connector collapses to nothing. Pin each column to its measured
// height at the width being captured; source badges wrap differently on mobile.
const pinStepColumns = async (section: HTMLElement) => {
  const columns = [
    ...section.querySelectorAll<HTMLElement>(".border-dashed:not(.hidden)"),
  ].flatMap((connector) =>
    connector.parentElement ? [connector.parentElement] : []
  );
  await act(() => {
    for (const column of columns) {
      column.style.height = "";
    }
  });
  const heights = columns.map((column) => column.offsetHeight);
  await act(() => {
    for (const [index, column] of columns.entries()) {
      column.style.height = `${heights[index]}px`;
    }
  });
};

test("deep-research renders every state in the chat", () =>
  captureChatStory("deep-research", [
    {
      label: "Starting",
      ui: (
        <DeepResearchRenderer
          isReadonly
          messageId={messageId}
          tool={{ input: {}, state: "input-available", toolCallId }}
        />
      ),
    },
    {
      label: "Searching",
      ui: (
        <DeepResearchRenderer
          isReadonly
          messageId={messageId}
          tool={{
            input: {},
            state: "input-available",
            toolCallId,
            updates: searching,
          }}
        />
      ),
    },
    {
      beforeCapture: pinStepColumns,
      label: "Report written, steps expanded",
      settle: async (section) => {
        const toggle = section.querySelector("button");
        if (!toggle) {
          throw new Error("Research progress toggle missing");
        }
        await act(() => toggle.click());
        await expect
          .poll(() => section.textContent)
          .toContain("Comparing the findings");
      },
      ui: (
        <ArtifactProvider>
          <DeepResearchRenderer
            isReadonly
            messageId={messageId}
            tool={{
              input: {},
              output: report,
              state: "output-available",
              toolCallId,
              updates: finished,
            }}
          />
        </ArtifactProvider>
      ),
    },
    {
      label: "Clarifying questions",
      ui: (
        <DeepResearchRenderer
          isReadonly
          messageId={messageId}
          tool={{
            input: {},
            output: {
              answer:
                "Is this for a home setup or a café? And roughly what budget?",
              format: "clarifying_questions",
            },
            state: "output-available",
            toolCallId,
          }}
        />
      ),
    },
    {
      label: "Research failed",
      ui: (
        <DeepResearchRenderer
          isReadonly
          messageId={messageId}
          tool={{
            errorText: "The research could not be completed.",
            input: {},
            state: "output-error",
            toolCallId,
          }}
        />
      ),
    },
  ]));
