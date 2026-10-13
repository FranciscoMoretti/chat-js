import { expect, test } from "vitest";

import { getLanguageFromFileName } from "./utils";

test("file languages retain case-insensitive suffix selection and fallback", () => {
  expect(getLanguageFromFileName("REPORT.C")).toBe("c");
  expect(getLanguageFromFileName("script.R")).toBe("r");
  expect(getLanguageFromFileName("nested.source.TSX")).toBe("tsx");
  expect(getLanguageFromFileName("unrecognized.extension")).toBe("python");
  expect(getLanguageFromFileName("trailing.")).toBe("python");
  expect(getLanguageFromFileName("")).toBe("python");
});
