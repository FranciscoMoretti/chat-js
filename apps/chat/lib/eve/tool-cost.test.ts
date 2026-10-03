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
/* oxlint-disable typescript/explicit-function-return-type --
 * typescript/explicit-function-return-type (#560): Keep vi.mock("../ai/to-model-data")'s return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 */
vi.mock("../ai/to-model-data", () => ({
  toModelData: (value: unknown) => value,
}));
/* oxlint-enable typescript/explicit-function-return-type */

/* oxlint-disable no-magic-numbers  --
 * no-magic-numbers (#517): test("combines API and nested model usage without rounding each call") uses 5, 0.0505 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * oxc/no-async-await (#540): test("combines API and nested model usage without rounding each call") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 */
test("combines API and nested model usage without rounding each call", async () => {
  const cost = createEveToolCost();
  cost.addAPICost("api", 5);
  cost.addLLMCost("priced", { inputTokens: 100, outputTokens: 200 }, "image");
  expect(await cost.totalUsd()).toBeCloseTo(0.0505);
  expect(await cost.totalUsd()).toBeCloseTo(0.0505);
});
/* oxlint-enable no-magic-numbers */
/* oxlint-disable no-magic-numbers  --
 * no-magic-numbers (#517): test("includes dedicated image pricing in the durable total") uses 2, 0.08 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * oxc/no-async-await (#540): test("includes dedicated image pricing in the durable total") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 */
test("includes dedicated image pricing in the durable total", async () => {
  const cost = createEveToolCost();
  cost.addImageCost("priced-image", 2, {}, "image");
  expect(await cost.totalUsd()).toBeCloseTo(0.08);
});
/* oxlint-enable no-magic-numbers */
test("missing pricing and missing usage remain unknown rather than free", async () => {
  const missing = createEveToolCost();
  missing.addLLMCost("missing", { inputTokens: 0, outputTokens: 1 }, "image");
  await expect(missing.totalUsd()).resolves.toBeUndefined();
  const empty = createEveToolCost();
  empty.addLLMCost("priced", {}, "image");
  await expect(empty.totalUsd()).resolves.toBeUndefined();
});

/* oxlint-disable typescript/prefer-readonly-parameter-types  --
 * oxc/no-async-await (#540): test.each([{ inputTokens: 100 }, { outputTokens: 100 }])("partial usage remains unres sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * typescript/prefer-readonly-parameter-types (#565): test.each([{ inputTokens: 100 }, { outputTokens: 100 }])("partial usage remains unres accepts usage; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 */
test.each([{ inputTokens: 100 }, { outputTokens: 100 }])(
  "partial usage remains unresolved: %j",
  async (usage) => {
    const cost = createEveToolCost();
    cost.addLLMCost("priced", usage, "image");
    await expect(cost.totalUsd()).resolves.toBeUndefined();
  }
);
/* oxlint-enable typescript/prefer-readonly-parameter-types */
