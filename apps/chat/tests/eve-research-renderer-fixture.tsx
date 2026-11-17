import type { EveMessagePart } from "eve/client";
import { renderToStaticMarkup } from "react-dom/server";

import { EveToolResult } from "../components/eve/eve-tool-result";
import { createToolResult } from "../lib/eve/tool-result";

const common = {
  input: { request: "Research a launch plan" },
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
    output: createToolResult({ format: "progress" }, 0, [
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
        path: "/workspace/research/example/report.md",
        title: "Research report",
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
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      {parts.map((part) => (
        <section key={JSON.stringify(part)}>
          <EveToolResult isReadonly messageId="fixture" part={part} />
        </section>
      ))}
    </main>
  )
);
