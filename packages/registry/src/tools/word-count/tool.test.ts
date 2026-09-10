import { expect, test } from "bun:test";
import { wordCount } from "./tool";

test("word count source handles empty text and whitespace without phantom words", async () => {
	if (!wordCount.execute) throw new Error("wordCount must be executable");
	const options = { toolCallId: "test", messages: [], context: {} };
	expect(await wordCount.execute({ text: " \n\t " }, options)).toEqual({
		words: 0,
		characters: 4,
		charactersNoSpaces: 0,
		sentences: 0,
	});
	expect(await wordCount.execute({ text: "One two three." }, options)).toEqual({
		words: 3,
		characters: 14,
		charactersNoSpaces: 12,
		sentences: 1,
	});
});
