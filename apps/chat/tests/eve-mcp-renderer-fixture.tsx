import type { EveMessagePart } from "eve/client";
import { createRoot } from "react-dom/client";
import { EveMcpResult } from "../components/eve/eve-mcp-result";
import { McpToolResult } from "../components/part/mcp-tool-result";

const common = {
  type: "dynamic-tool",
  toolName: "local__echo",
  toolCallId: "echo",
  input: { text: "Hello MCP" },
} as const;
const parts: Extract<EveMessagePart, { type: "dynamic-tool" }>[] = [
  { ...common, state: "input-streaming", inputText: "" },
  { ...common, state: "input-available" },
  {
    ...common,
    state: "output-available",
    output: {
      kind: "chatjs.mcp-result",
      output: { text: "Hello MCP" },
      modelOutput: { type: "text", value: "Hello MCP" },
    },
  },
  ...[false, 0, true, null, ""].map((output, index) => ({
    ...common,
    toolName: `local__value_${index}`,
    toolCallId: `value-${index}`,
    state: "output-available" as const,
    output: {
      kind: "chatjs.mcp-result",
      output,
      modelOutput: { type: "json", value: output },
    },
  })),
  { ...common, state: "output-error", errorText: "private connector URL" },
  {
    ...common,
    state: "output-denied",
    approval: { id: "fixture", approved: false },
  },
  { ...common, state: "output-available", output: { invalid: true } },
];
const root = document.getElementById("fixture");
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
            toolName: `local__value_${index}`,
            input: {},
            state: "output-available",
            output,
          }}
        />
      ))}
    </section>
  </main>
);
