import { expect, test, vi } from "vitest";
import { createEveToolCost } from "./tool-cost";

vi.mock("../ai/active-gateway", () => ({
  getActiveGateway: () => ({
    fetchModels: async () => [
      { id: "priced", pricing: { input: "0.000001", output: "0.000002" } },
    ],
  }),
}));
vi.mock("../ai/to-model-data", () => ({
  toModelData: (value: unknown) => value,
}));

test("combines API and nested model usage without rounding each call", async () => {
  const cost = createEveToolCost();
  cost.addAPICost("api", 5);
  cost.addLLMCost("priced", { inputTokens: 100, outputTokens: 200 }, "image");
  expect(await cost.totalUsd()).toBeCloseTo(0.0505);
  expect(await cost.totalUsd()).toBeCloseTo(0.0505);
});
test("missing pricing and missing usage remain unknown rather than free", async () => {
  const missing = createEveToolCost();
  missing.addLLMCost("missing", { inputTokens: 0, outputTokens: 1 }, "image");
  await expect(missing.totalUsd()).rejects.toThrow("pricing is unavailable");
  const empty = createEveToolCost();
  empty.addLLMCost("priced", {}, "image");
  await expect(empty.totalUsd()).rejects.toThrow("usage is unavailable");
});

test.each([
  { inputTokens: 100 },
  { outputTokens: 100 },
])("partial usage remains unresolved: %j", async (usage) => {
  const cost = createEveToolCost();
  cost.addLLMCost("priced", usage, "image");
  await expect(cost.totalUsd()).rejects.toThrow("usage is unavailable");
});
