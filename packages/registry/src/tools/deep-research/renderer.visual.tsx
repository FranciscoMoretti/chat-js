import React from "react";
import { expect, test } from "vitest";

import type { ResearchUpdate } from "@/tools/platform/research-updates-schema";

import { captureChatStory, flush } from "../_shared/visual";
import { DeepResearchRenderer } from "./renderer";

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
    message: "Comparing evidence about espresso grinders.",
    status: "running",
    title: "Researching topic",
    toolCallId,
    type: "thoughts",
  },
];

const finished: ResearchUpdate[] = [
  started,
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
  format: "report",
  path: "/workspace/research/example/report.md",
  title: "Research report",
};

test("deep-research renders every state in the chat", async () => {
  await captureChatStory("deep-research", [
    {
      label: "Starting",
      ui: (
        <DeepResearchRenderer
          isReadonly
          messageId={messageId}
          tool={{
            input: { request: "Research a launch plan" },
            state: "input-available",
            toolCallId,
          }}
        />
      ),
    },
    {
      label: "Researching a topic",
      ui: (
        <DeepResearchRenderer
          isReadonly
          messageId={messageId}
          tool={{
            input: { request: "Research a launch plan" },
            state: "input-available",
            toolCallId,
            updates: searching,
          }}
        />
      ),
    },
    {
      label: "Report written, steps expanded",
      settle: async (section) => {
        const toggle = section.querySelector("button");
        if (!toggle) {
          throw new Error("Research progress toggle missing");
        }
        await flush(() => {
          toggle.click();
        });
        await expect
          .poll(() => section.textContent)
          .toContain("Comparing the findings");
      },
      ui: (
        <DeepResearchRenderer
          isReadonly
          messageId={messageId}
          tool={{
            input: { request: "Research a launch plan" },
            output: report,
            state: "output-available",
            toolCallId,
            updates: finished,
          }}
        />
      ),
    },
    {
      label: "Clarifying questions",
      ui: (
        <DeepResearchRenderer
          isReadonly
          messageId={messageId}
          tool={{
            input: { request: "Research a launch plan" },
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
            input: { request: "Research a launch plan" },
            state: "output-error",
            toolCallId,
          }}
        />
      ),
    },
  ]);
});
