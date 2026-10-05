import { expect, test } from "bun:test";

import type { ToolContext } from "eve/tools";

import { toolResultSchema } from "@/lib/eve/tool-result";

import { wordCount } from "./tool";

const ZERO_COST_USD = 0;

const unexpected = (): never => {
  throw new Error("Word count must not acquire external resources");
};

test("word count source handles empty text and whitespace without phantom words", async () => {
  const options = {
    abortSignal: new AbortController().signal,
    callId: "test",
    getSandbox: unexpected,
    getSkill: unexpected,
    getToken: unexpected,
    requireAuth: unexpected,
    session: {
      // oxlint-disable-next-line unicorn/no-null -- Eve SessionAuth uses null for both absent current and initiating authentication; undefined or an invented authenticated context would change this anonymous-tool fixture.
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
  expect(result.usage.costUsd).toBe(ZERO_COST_USD);
  expect(result.output).toEqual({
    characters: 14,
    charactersNoSpaces: 12,
    sentences: 1,
    words: 3,
  });
});
