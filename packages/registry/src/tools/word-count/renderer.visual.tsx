import { test, vi } from "vitest";

import { EveToolResult } from "@/components/eve/eve-tool-result";
import { createToolError, createToolResult } from "@/lib/eve/tool-result";

import { captureChatStory } from "../_shared/visual";
import { WordCountRenderer } from "./renderer";

// The chat resolves an installed tool's renderer through this registry.
vi.mock("@/lib/ai/tool-renderer-registry", () => ({
  getEveInstalledToolRenderer: () => WordCountRenderer,
}));

const receipt = {
  input: { text: "one two" },
  state: "output-available",
  toolName: "wordCount",
  type: "dynamic-tool",
} as const;

const messageId = "word-count-message";

test("word-count renders every state in the chat", () =>
  captureChatStory("word-count", [
    {
      label: "Counting",
      ui: (
        <WordCountRenderer
          isReadonly
          messageId={messageId}
          tool={{
            input: { text: "one two three" },
            state: "input-available",
            toolCallId: "word-count-input",
          }}
        />
      ),
    },
    {
      label: "Counted",
      ui: (
        <WordCountRenderer
          isReadonly
          messageId={messageId}
          tool={{
            input: { text: "one two three" },
            output: {
              characters: 13,
              charactersNoSpaces: 11,
              sentences: 1,
              words: 3,
            },
            state: "output-available",
            toolCallId: "word-count-output",
          }}
        />
      ),
    },
    {
      label: "Tool unavailable",
      ui: (
        <WordCountRenderer
          isReadonly
          messageId={messageId}
          tool={{
            errorText: "Tool unavailable",
            input: undefined,
            state: "output-error",
            toolCallId: "word-count-error",
          }}
        />
      ),
    },
    {
      label: "Chat receipt",
      ui: (
        <EveToolResult
          isReadonly
          messageId={messageId}
          part={{
            ...receipt,
            output: createToolResult(
              { characters: 7, charactersNoSpaces: 6, sentences: 1, words: 2 },
              0
            ),
            toolCallId: "word-count-receipt",
          }}
        />
      ),
    },
    {
      label: "Chat receipt, tool failed",
      ui: (
        <EveToolResult
          isReadonly
          messageId={messageId}
          part={{
            ...receipt,
            output: createToolError(0.02),
            toolCallId: "word-count-receipt-error",
          }}
        />
      ),
    },
  ]));
