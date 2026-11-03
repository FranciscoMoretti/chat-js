import type { EveMessagePart } from "eve/client";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { EveToolResult } from "../components/eve/eve-tool-result";
import { ArtifactProvider } from "../hooks/use-artifact";
import { createToolResult } from "../lib/eve/tool-result";

const common = {
  input: {},
  callId: "research",
  name: "deepResearch",
  label: "deepResearch",
  type: "tool",
  kind: "tool",
  stepIndex: 0,
} as const;
const parts: Extract<EveMessagePart, { type: "tool" }>[] = [
  { ...common, input: undefined, inputText: "", state: "streaming" },
  { ...common, state: "requested" },
  {
    ...common,
    output: createToolResult({ searches: [] }, 0, [
      {
        type: "started",
        title: "Research started",
        timestamp: 0,
        toolCallId: "research",
      },
    ]),
    state: "completed",
  },
  {
    ...common,
    output: createToolResult(
      {
        format: "clarifying_questions",
        answer: "Which time period should the research cover?",
      },
      0
    ),
    state: "completed",
  },
  {
    ...common,
    output: createToolResult(
      {
        format: "report",
        status: "success",
        result: "Saved",
        documentId: "60dbe86a-b2c4-4d32-ae09-a00e90b84e99",
        revisionId: "663ccf42-10c9-453f-b9da-ebf684a6da97",
        title: "Research report",
        kind: "text",
        date: "2026-09-10",
      },
      0.5
    ),
    state: "completed",
  },
  {
    ...common,
    error: { code: "fixture_error", message: "Research provider unavailable" },
    state: "failed",
  },
  {
    ...common,

    state: "rejected",
  },
  {
    ...common,
    output: createToolResult({ error: "Report could not be saved." }, 0.5),
    state: "completed",
  },
  { ...common, output: { invalid: true }, state: "completed" },
];
process.stdout.write(
  renderToStaticMarkup(
    <ArtifactProvider>
      <main className="mx-auto max-w-3xl space-y-6 p-6">
        {parts.map((part) => (
          <section key={JSON.stringify(part)}>
            <EveToolResult isReadonly messageId="fixture" part={part} />
          </section>
        ))}
      </main>
    </ArtifactProvider>
  )
);
