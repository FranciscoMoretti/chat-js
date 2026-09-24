import type { EveMessagePart } from "eve/client";
import { createRoot } from "react-dom/client";

import { EveMcpResult } from "../components/eve/eve-mcp-result";
import { McpToolResult } from "../components/part/mcp-tool-result";

const common = {
  input: { text: "Hello MCP" },
  toolCallId: "echo",
  toolName: "local__echo",
  type: "dynamic-tool",
} as const;
const parts: Extract<EveMessagePart, { type: "dynamic-tool" }>[] = [
  { ...common, inputText: "", state: "input-streaming" },
  { ...common, state: "input-available" },
  {
    ...common,
    output: {
      kind: "chatjs.mcp-result",
      modelOutput: { type: "text", value: "Hello MCP" },
      output: { text: "Hello MCP" },
    },
    state: "output-available",
  },
  ...[false, 0, true, null, ""].map((output, index) => ({
    ...common,
    output: {
      kind: "chatjs.mcp-result",
      modelOutput: { type: "json", value: output },
      output,
    },
    state: "output-available" as const,
    toolCallId: `value-${index}`,
    toolName: `local__value_${index}`,
  })),
  { ...common, errorText: "private connector URL", state: "output-error" },
  {
    ...common,
    approval: { approved: false, id: "fixture" },
    state: "output-denied",
  },
  { ...common, output: { invalid: true }, state: "output-available" },
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
