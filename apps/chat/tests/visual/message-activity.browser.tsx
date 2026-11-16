import { BashOutput } from "@/components/eve/bash-output";
import { McpToolResult } from "@/components/part/mcp-tool-result";
import { ReasoningPart } from "@/components/part/message-reasoning";
import { expect, test } from "vitest";
import { captureChatStory } from "../../../../packages/registry/src/tools/_shared/visual";
import "./sandbox.css";

const states = [
  "input-streaming",
  "input-available",
  "approval-requested",
  "approval-responded",
  "output-denied",
  "output-error",
  "output-available",
] as const;

test("native traces preserve all tool states and falsy outputs", async () => {
  await captureChatStory("message-activity", [
    ...states.map((state) => ({
      label: state,
      ui: (
        <McpToolResult
          defaultOpen
          part={{
            toolName: "Lookup inventory",
            state,
            input: { product: "ChatJS" },
            output: { available: true },
            errorText: "Provider unavailable. Try again.",
          }}
        />
      ),
    })),
    ...[false, 0, "", null].map((output) => ({
      label: `Output: ${JSON.stringify(output)}`,
      ui: (
        <McpToolResult
          defaultOpen
          part={{
            toolName: "Result",
            state: "output-available",
            output,
            input: undefined,
          }}
        />
      ),
    })),
    {
      label: "Streaming reasoning",
      ui: (
        <ReasoningPart content="Comparing the available evidence." isLoading />
      ),
    },
    {
      label: "Code execution",
      ui: (
        <BashOutput
          output={{
            status: "completed",
            exitCode: 0,
            stdout: "Hello",
            stderr: "",
            truncated: false,
          }}
        />
      ),
      settle: (section) => {
        expect(section.textContent).toContain("Hello");
        expect(section.textContent).toContain("Exit code: 0");
      },
    },
  ]);
});
