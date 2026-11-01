import { expect, test } from "vitest";

import { isNonEmptyString } from "./is-non-empty-string";

test.each([
  { value: "", expected: false },
  { value: undefined, expected: false },
  { value: null, expected: false },
  { value: 0, expected: false },
  { value: Number.NaN, expected: false },
  { value: false, expected: false },
  { value: {}, expected: false },
  { value: " ", expected: true },
  { value: "0", expected: true },
  { value: "id", expected: true },
])(
  "recognizes nonempty strings without trimming: $value",
  ({ value, expected }) => {
    expect(isNonEmptyString(value)).toBe(expected);
  }
);
