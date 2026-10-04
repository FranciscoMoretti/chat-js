import { expect, test } from "bun:test";

import type { ToolContext } from "eve/tools";

import { toolResultSchema } from "@/lib/eve/tool-result";

import { wordCount } from "./tool";

const unexpected = (): never => {
  throw new Error("Word count must not acquire external resources");
};

/* oxlint-disable unicorn/no-null -- ToolContext represents absent current and initiating authentication with null; retain the SDK session contract in this resource-free word-count fixture. */
/* oxlint-disable eslint/no-magic-numbers -- Keep exact input-derived character, sentence, word, and zero-cost results next to the word-count assertions. */
test("word count source handles empty text and whitespace without phantom words", async () => {
  const options = {
    abortSignal: new AbortController().signal,
    callId: "test",
    getSandbox: unexpected,
    getSkill: unexpected,
    getToken: unexpected,
    requireAuth: unexpected,
    session: {
      auth: { current: null, initiator: null },
      id: "test",
      turn: { id: "turn", sequence: 0 },
    },
    toolName: "wordCount",
  } satisfies ToolContext;
  const empty = toolResultSchema.parse(
    await wordCount.execute({ text: " \n\t " }, options)
  );
  expect(empty.output).toEqual({
    characters: 4,
    charactersNoSpaces: 0,
    sentences: 0,
    words: 0,
  });
  const result = toolResultSchema.parse(
    await wordCount.execute({ text: "One two three." }, options)
  );
  expect(result.usage.costUsd).toBe(0);
  expect(result.output).toEqual({
    characters: 14,
    charactersNoSpaces: 12,
    sentences: 1,
    words: 3,
  });
});
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable unicorn/no-null */
