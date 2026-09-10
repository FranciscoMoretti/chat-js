import { expect, test } from "vitest";
import { createEvePlatformResult, evePlatformResult } from "./platform-result";

test("tool receipts preserve known zero cost and reject invalid billing values", () => {
  expect(
    createEvePlatformResult({ message: "failed", chart: "" }, 0).usage.costUsd
  ).toBe(0);
  for (const cost of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
    expect(() => createEvePlatformResult({}, cost)).toThrow();
  }
  expect(
    evePlatformResult.safeParse({
      kind: "chatjs.platform-result",
      version: 1,
      output: {},
    }).success
  ).toBe(false);
});
