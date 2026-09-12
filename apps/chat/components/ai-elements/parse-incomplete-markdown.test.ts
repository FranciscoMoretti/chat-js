import { expect, it } from "vitest";

import { parseIncompleteMarkdown } from "./parseIncompleteMarkdown";

it("normalizes incomplete streamed markdown delimiters", () => {
  expect(parseIncompleteMarkdown("Read [partial")).toBe("Read ");
  expect(parseIncompleteMarkdown("![partial")).toBe("");
  expect(parseIncompleteMarkdown("**bold")).toBe("**bold**");
  expect(parseIncompleteMarkdown("_italic")).toBe("_italic_");
  expect(parseIncompleteMarkdown("`code")).toBe("`code`");
  expect(parseIncompleteMarkdown("```code")).toBe("```code");
  expect(parseIncompleteMarkdown("~~removed")).toBe("~~removed~~");
});
