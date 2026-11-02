import type { EveMessagePart } from "eve/client";
import React from "react";
import { createRoot } from "react-dom/client";

import { EveMcpResult } from "../components/eve/eve-mcp-result";
import { McpToolResult } from "../components/part/mcp-tool-result";

const common = {
  input: { text: "Hello MCP" },
  callId: "echo",
  name: "local__echo",
  label: "local__echo",
  type: "tool",
  kind: "tool",
  stepIndex: 0,
} as const;
const parts: Extract<EveMessagePart, { type: "tool" }>[] = [
  { ...common, input: undefined, inputText: "", state: "streaming" },
  { ...common, state: "requested" },
  {
    ...common,
    output: {
      kind: "chatjs.mcp-result",
      modelOutput: { type: "text", value: "Hello MCP" },
      output: { text: "Hello MCP" },
    },
    state: "completed",
  },
  ...[false, 0, true, null, ""].map((output, index) => ({
    ...common,
    output: {
      kind: "chatjs.mcp-result",
      modelOutput: { type: "json", value: output },
      output,
    },
    state: "completed" as const,
    callId: `value-${index}`,
    name: `local__value_${index}`,
    label: `local__value_${index}`,
  })),
  {
    ...common,
    error: { code: "fixture_error", message: "private connector URL" },
    state: "failed",
  },
  {
    ...common,

    state: "rejected",
  },
  { ...common, output: { invalid: true }, state: "completed" },
];
const root = document.querySelector("#fixture");
if (!root) {
  throw new Error("Missing fixture root");
}
createRoot(root).render(
  <main className="mx-auto max-w-3xl space-y-6 p-6">
    <section className="space-y-6" id="native-mcp">
      {parts.map((part) => (
        <EveMcpResult defaultOpen key={JSON.stringify(part)} part={part} />
      ))}
    </section>
    <section className="space-y-6" id="legacy-mcp">
      {[false, 0, true, null, ""].map((output, index) => (
        <McpToolResult
          defaultOpen
          key={JSON.stringify(output)}
          part={{
            input: {},
            output,
            state: "output-available",
            toolName: `local__value_${index}`,
          }}
        />
      ))}
    </section>
  </main>
);
