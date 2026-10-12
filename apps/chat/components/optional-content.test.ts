import { describe, expect, test } from "vitest";
import { hasCustomContent } from "./custom-content";
import { hasText, nonEmptyText } from "./text-value";

describe("optional UI content", () => {
  test("omits chrome for every historically falsy React child", () => {
    for (const value of [null, undefined, false, "", 0, -0, 0n, Number.NaN]) {
      expect(hasCustomContent(value)).toBe(false);
    }
  });

  test("preserves custom content including whitespace and empty collections", () => {
    for (const value of [true, " ", "title", 1, -1, 1n, [], Infinity]) {
      expect(hasCustomContent(value)).toBe(true);
    }
  });

  test("string fallback ignores only absent or empty values", () => {
    for (const value of [null, undefined, ""]) {
      expect(hasText(value)).toBe(false);
      expect(nonEmptyText(value)).toBeUndefined();
    }
    for (const value of [" ", "0", "Provider error"]) {
      expect(hasText(value)).toBe(true);
      expect(nonEmptyText(value)).toBe(value);
    }
  });
});
