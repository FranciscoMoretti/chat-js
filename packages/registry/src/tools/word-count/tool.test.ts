import { expect, test } from "bun:test";

import { wordCount } from "./tool";

test("word count source handles empty text and whitespace without phantom words", async () => {
  if (!wordCount.execute) {
    throw new Error("wordCount must be executable");
  }
  const options = { context: {}, messages: [], toolCallId: "test" };
  expect(await wordCount.execute({ text: " \n\t " }, options)).toEqual({
    characters: 4,
    charactersNoSpaces: 0,
    sentences: 0,
    words: 0,
  });
  expect(await wordCount.execute({ text: "One two three." }, options)).toEqual({
    characters: 14,
    charactersNoSpaces: 12,
    sentences: 1,
    words: 3,
  });
});
