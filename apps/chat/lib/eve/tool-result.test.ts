import { expect, test } from "vitest";

import { createToolResult, toolResultSchema } from "./tool-result";

test("tool receipts preserve known zero cost and reject invalid billing values", () => {
  expect(
    createToolResult({ chart: "", message: "failed" }, 0).usage.costUsd
  ).toBe(0);
  for (const cost of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
    expect(() => createToolResult({}, cost)).toThrow();
  }
  expect(
    toolResultSchema.safeParse({
      kind: "chatjs.tool-result",
      output: {},
      status: "success",
      version: 1,
    }).success
  ).toBe(false);
});
