import { expect, test } from "vitest";

import { createToolResult, toolResultSchema } from "./tool-result";

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): test("tool receipts preserve known zero cost and reject invalid billing values") uses 0, -1 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
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
/* oxlint-enable no-magic-numbers */
