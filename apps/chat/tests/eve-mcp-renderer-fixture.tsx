import type { EveMessagePart } from "eve/client";
import { createRoot } from "react-dom/client";
import { EveMcpResult } from "../components/eve/eve-mcp-result";

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
    {parts.map((part) => (
      <EveMcpResult defaultOpen key={JSON.stringify(part)} part={part} />
    ))}
  </main>
);
