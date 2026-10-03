/* oxlint-disable eslint/max-lines-per-function -- A story lists every renderer state in one capture call, so its length grows with the states it covers. */
/* oxlint-disable eslint/no-magic-numbers -- Fixture values, viewport widths and canvas sizes are literal test data. */
/* oxlint-disable eslint/no-undefined -- Undefined represents an omitted optional argument or absent value in the existing TypeScript/SDK contract. */
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
/* oxlint-disable import/no-relative-parent-imports -- Stories import the shared harness from the sibling _shared directory. */
/* oxlint-disable oxc/no-rest-spread-properties -- Copying these properties preserves immutable updates and the existing structural API without mutating the source object. */
/* oxlint-disable react-perf/jsx-no-new-object-as-prop -- Each story renders once per capture; memoizing fixture props would only add noise. */
/* oxlint-disable typescript/explicit-function-return-type -- Return types are inferred from the fixtures and helpers they wrap. */
/* oxlint-disable typescript/promise-function-async -- Test and settle callbacks return the capture promise directly. */

import React from "react";
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
      label: "Input still streaming (renders nothing)",
      ui: (
        <WordCountRenderer
          isReadonly
          messageId={messageId}
          tool={{ state: "input-streaming", toolCallId: "word-count-stream" }}
        />
      ),
    },
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
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable react-perf/jsx-no-new-object-as-prop */
/* oxlint-enable oxc/no-rest-spread-properties */
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-enable eslint/sort-imports */
/* oxlint-enable eslint/no-undefined */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/max-lines-per-function */
