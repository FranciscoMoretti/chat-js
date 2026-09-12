import { expect, it } from "vitest";

import { parseIncompleteMarkdown } from "./parse-incomplete-markdown";

it("normalizes incomplete streamed markdown delimiters", () => {
  expect(parseIncompleteMarkdown("Read [partial")).toBe("Read ");
  expect(parseIncompleteMarkdown("![partial")).toBe("");
  expect(parseIncompleteMarkdown("**bold")).toBe("**bold**");
  expect(parseIncompleteMarkdown("_italic")).toBe("_italic_");
  expect(parseIncompleteMarkdown("😀*italic")).toBe("😀*italic*");
  expect(parseIncompleteMarkdown("😀_italic")).toBe("😀_italic_");
  expect(parseIncompleteMarkdown("`code")).toBe("`code`");
  expect(parseIncompleteMarkdown("```code")).toBe("```code");
  expect(parseIncompleteMarkdown("~~removed")).toBe("~~removed~~");
});

it("completes an unterminated inline code span", () => {
  expect(parseIncompleteMarkdown("Run `npm test")).toBe("Run `npm test`");
});

it("does not complete inline code inside an incomplete fenced code block", () => {
  expect(
    parseIncompleteMarkdown("```ts\nconst command = `npm test"),
  ).toBe("```ts\nconst command = `npm test");
});

it("preserves streamed triple-backtick fences", () => {
  expect(parseIncompleteMarkdown("```ts\nconst answer = 42")).toBe(
    "```ts\nconst answer = 42",
  );
  expect(parseIncompleteMarkdown("```ts\nconst answer = 42\n```")).toBe(
    "```ts\nconst answer = 42\n```",
  );
});
