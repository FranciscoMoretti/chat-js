/* oxlint-disable eslint/sort-keys -- Fixture field order mirrors serialized protocol and persistence payloads. */
import type { EveMessagePart } from "eve/client";
import { renderToStaticMarkup } from "react-dom/server";

import { EveToolResult } from "../components/eve/eve-tool-result";
import { ArtifactProvider } from "../hooks/use-artifact";
import { createToolResult } from "../lib/eve/tool-result";

const common = {
  input: {},
  toolCallId: "research",
  toolName: "deepResearch",
  type: "dynamic-tool",
} as const;
const parts: Extract<EveMessagePart, { type: "dynamic-tool" }>[] = [
  { ...common, inputText: "", state: "input-streaming" },
  { ...common, state: "input-available" },
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
    state: "output-available",
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
    state: "output-available",
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
    state: "output-available",
  },
  {
    ...common,
    errorText: "Research provider unavailable",
    state: "output-error",
  },
  {
    ...common,
    approval: { approved: false, id: "fixture" },
    state: "output-denied",
  },
  {
    ...common,
    output: createToolResult({ error: "Report could not be saved." }, 0.5),
    state: "output-available",
  },
  { ...common, output: { invalid: true }, state: "output-available" },
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
