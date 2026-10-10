import { expect, test, vi } from "vitest";

import { createEveToolCost } from "./tool-cost";

/* oxlint-disable typescript/explicit-function-return-type, typescript/promise-function-async --
 * typescript/explicit-function-return-type (#560): Keep vi.mock("../ai/active-gateway")'s return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 * typescript/promise-function-async (#606): vi.mock("../ai/active-gateway") preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
vi.mock("../ai/active-gateway", () => ({
  getActiveGateway: () => ({
    fetchModels: () =>
      Promise.resolve([
        { id: "priced", pricing: { input: "0.000001", output: "0.000002" } },
        { id: "priced-image", pricing: { image: "0.04" } },
      ]),
  }),
}));
/* oxlint-enable typescript/explicit-function-return-type, typescript/promise-function-async */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): test("combines API and nested model usage without rounding each call") uses 5, 0.0505 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
test("combines API and nested model usage without rounding each call", async () => {
  const cost = createEveToolCost();
  cost.addAPICost("api", 5);
  cost.addLLMCost("priced", { inputTokens: 100, outputTokens: 200 }, "image");
  expect(await cost.totalUsd()).toBeCloseTo(0.0505);
  expect(await cost.totalUsd()).toBeCloseTo(0.0505);
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers */
/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): test("includes dedicated image pricing in the durable total") uses 2, 0.08 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
test("includes dedicated image pricing in the durable total", async () => {
  const cost = createEveToolCost();
  cost.addImageCost("priced-image", 2, {}, "image");
  expect(await cost.totalUsd()).toBeCloseTo(0.08);
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers */
test("missing pricing and missing usage remain unknown rather than free", async () => {
  const missing = createEveToolCost();
  missing.addLLMCost("missing", { inputTokens: 0, outputTokens: 1 }, "image");
  await expect(missing.totalUsd()).resolves.toBeUndefined();
  const empty = createEveToolCost();
  empty.addLLMCost("priced", {}, "image");
  await expect(empty.totalUsd()).resolves.toBeUndefined();
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test.each([{ inputTokens: 100 }, { outputTokens: 100 }])'s awaited sequencing and rejected-Promise behavior. */

test.each([{ inputTokens: 100 }, { outputTokens: 100 }])(
  "partial usage remains unresolved: %j",
  async (
    usage: Readonly<
      | { inputTokens: number; outputTokens?: undefined }
      | { outputTokens: number; inputTokens?: undefined }
    >
  ) => {
    const cost = createEveToolCost();
    cost.addLLMCost("priced", usage, "image");
    await expect(cost.totalUsd()).resolves.toBeUndefined();
  }
);
/* oxlint-enable oxc/no-async-await */
