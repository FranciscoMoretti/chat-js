import { expect, test } from "bun:test";

import type { ToolContext } from "eve/tools";

import { toolResultSchema } from "@/lib/eve/tool-result";

import { wordCount } from "./tool";

/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
const unexpected = () => {
  throw new Error("Word count must not acquire external resources");
};
/* oxlint-enable typescript/explicit-function-return-type */

/* oxlint-disable oxc/no-async-await -- Await preserves the existing sequencing, rejection propagation, and cleanup behavior of this asynchronous operation. */
/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */
/* oxlint-disable eslint/no-magic-numbers -- These values are concrete test inputs and expected results; naming each literal would make the fixture harder to compare with its assertions. */
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
  // oxlint-disable-next-line typescript/no-unsafe-assignment, typescript/no-unsafe-call, typescript/no-unsafe-member-access -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
  const empty = toolResultSchema.parse(
    await wordCount.execute({ text: " \n\t " }, options)
  );
  // oxlint-disable-next-line typescript/no-unsafe-member-access -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
  expect(empty.output).toEqual({
    characters: 4,
    charactersNoSpaces: 0,
    sentences: 0,
    words: 0,
  });
  // oxlint-disable-next-line typescript/no-unsafe-assignment, typescript/no-unsafe-call, typescript/no-unsafe-member-access -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
  const result = toolResultSchema.parse(
    await wordCount.execute({ text: "One two three." }, options)
  );
  // oxlint-disable-next-line typescript/no-unsafe-member-access -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
  expect(result.usage.costUsd).toBe(0);
  // oxlint-disable-next-line typescript/no-unsafe-member-access -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
  expect(result.output).toEqual({
    characters: 14,
    charactersNoSpaces: 12,
    sentences: 1,
    words: 3,
  });
});
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable unicorn/no-null */
/* oxlint-enable oxc/no-async-await */
