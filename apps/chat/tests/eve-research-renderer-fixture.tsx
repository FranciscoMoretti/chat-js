import type { EveMessagePart } from "eve/client";
import { renderToStaticMarkup } from "react-dom/server";

import { EvePlatformToolResult } from "../components/eve/eve-platform-tool-result";
import { ArtifactProvider } from "../hooks/use-artifact";
import { createEvePlatformResult } from "../lib/eve/platform-result";

const common = {
  type: "dynamic-tool",
  toolName: "deepResearch",
  toolCallId: "research",
  input: {},
} as const;
const parts: Extract<EveMessagePart, { type: "dynamic-tool" }>[] = [
  { ...common, state: "input-streaming", inputText: "" },
  { ...common, state: "input-available" },
  {
    ...common,
    state: "output-available",
    output: createEvePlatformResult({ searches: [] }, 0, [
      {
        type: "started",
        title: "Research started",
        timestamp: 0,
        toolCallId: "research",
      },
    ]),
  },
  {
    ...common,
    state: "output-available",
    output: createEvePlatformResult(
      {
        format: "clarifying_questions",
        answer: "Which time period should the research cover?",
      },
      0
    ),
  },
  {
    ...common,
    state: "output-available",
    output: createEvePlatformResult(
      {
        format: "report",
        status: "success",
        documentId: "60dbe86a-b2c4-4d32-ae09-a00e90b84e99",
        revisionId: "663ccf42-10c9-453f-b9da-ebf684a6da97",
        title: "Research report",
        kind: "text",
        date: "2026-09-10",
      },
      0.5
    ),
  },
  {
    ...common,
    state: "output-error",
    errorText: "Research provider unavailable",
  },
  {
    ...common,
    state: "output-denied",
    approval: { id: "fixture", approved: false },
  },
  {
    ...common,
    state: "output-available",
    output: createEvePlatformResult(
      { error: "Report could not be saved." },
      0.5
    ),
  },
  { ...common, state: "output-available", output: { invalid: true } },
];
process.stdout.write(
  renderToStaticMarkup(
    <ArtifactProvider>
      <main className="mx-auto max-w-3xl space-y-6 p-6">
        {parts.map((part) => (
          <section key={JSON.stringify(part)}>
            <EvePlatformToolResult isReadonly messageId="fixture" part={part} />
          </section>
        ))}
      </main>
    </ArtifactProvider>
  )
);
