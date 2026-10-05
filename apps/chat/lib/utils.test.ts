import { expect, test } from "vitest";

import {
  getLanguageFromFileName,
  getTextContentFromModelMessage,
} from "./utils";

test("file languages retain case-insensitive suffix selection and fallback", () => {
  expect(getLanguageFromFileName("REPORT.C")).toBe("c");
  expect(getLanguageFromFileName("script.R")).toBe("r");
  expect(getLanguageFromFileName("nested.source.TSX")).toBe("tsx");
  expect(getLanguageFromFileName("unrecognized.extension")).toBe("python");
  expect(getLanguageFromFileName("trailing.")).toBe("python");
  expect(getLanguageFromFileName("")).toBe("python");
});

test("model text extraction accepts readonly content and preserves part separators", () => {
  expect(
    getTextContentFromModelMessage({ content: "plain", role: "user" })
  ).toBe("plain");
  expect(
    getTextContentFromModelMessage({
      content: [
        { text: "first", type: "text" },
        { image: "https://example.com/image.png", type: "image" },
        { text: "last", type: "text" },
      ],
      role: "user",
    } as const)
  ).toBe("first\n\nlast");
});
