import { beforeEach, describe, expect, it, vi } from "vitest";

import { gatewayModelDefaults } from "@/lib/ai/gateway-model-defaults";

const { fetchModels, getAppModelDefinition } = vi.hoisted(() => ({
  fetchModels:
    vi.fn<() => Promise<{ id: string; pricing: { image: string } }[]>>(),
  getAppModelDefinition:
    vi.fn<
      (
        modelId: string
      ) => Promise<{ pricing?: { input: string; output: string } }>
    >(),
}));

vi.mock("../ai/app-models", () => ({ getAppModelDefinition }));
vi.mock("@/lib/ai/models", () => ({ fetchModels }));

beforeEach(() => {
  fetchModels.mockReset().mockResolvedValue([]);
  getAppModelDefinition.mockReset().mockResolvedValue({
    pricing: { input: "0.00001", output: "0.00003" },
  });
});

// oxlint-disable-next-line node/no-top-level-await -- This Vitest suite loads the accumulator after installing the controlled model-pricing dependency.
const { CostAccumulator } = await import("./cost-accumulator");
/* oxlint-disable max-lines-per-function, no-magic-numbers --
 * max-lines-per-function (#510): describe("CostAccumulator") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): describe("CostAccumulator") uses 3, 0, 5, 35, 8, 1 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
describe("CostAccumulator", () => {
  describe("LLM cost calculation", () => {
    /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
    it("should calculate cost from tokens and pricing", async () => {
      const accumulator = new CostAccumulator();
      accumulator.addLLMCost(
        gatewayModelDefaults.workflows.chat,
        { inputTokens: 1000, outputTokens: 500 },
        "test"
      );
      const cost = await accumulator.getTotalCost();
      expect(getAppModelDefinition).toHaveBeenCalledWith(
        gatewayModelDefaults.workflows.chat
      );
      // 1000 * 0.00001 = 0.01 (input)
      // 500 * 0.00003 = 0.015 (output)
      // Total = 0.025 dollars = 2.5 cents, ceil = 3
      expect(cost).toBe(3);
    });
    /* oxlint-enable oxc/no-async-await */
    /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
    it("should return 0 for zero tokens", async () => {
      const accumulator = new CostAccumulator();
      accumulator.addLLMCost(
        gatewayModelDefaults.workflows.chat,
        { inputTokens: 0, outputTokens: 0 },
        "test"
      );
      const cost = await accumulator.getTotalCost();
      expect(cost).toBe(0);
    });
    /* oxlint-enable oxc/no-async-await */
    /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
    it("should handle undefined tokens as zero", async () => {
      const accumulator = new CostAccumulator();
      accumulator.addLLMCost(gatewayModelDefaults.workflows.chat, {}, "test");
      const cost = await accumulator.getTotalCost();
      expect(cost).toBe(0);
    });
    /* oxlint-enable oxc/no-async-await */
    /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
    it("should handle Claude 3.5 Sonnet pricing", async () => {
      getAppModelDefinition.mockResolvedValue({
        pricing: { input: "0.000003", output: "0.000015" },
      });
      const accumulator = new CostAccumulator();
      accumulator.addLLMCost(
        gatewayModelDefaults.workflows.chat,
        { inputTokens: 10_000, outputTokens: 1000 },
        "test"
      );
      const cost = await accumulator.getTotalCost();
      // 10000 * 0.000003 = 0.03 (input)
      // 1000 * 0.000015 = 0.015 (output)
      // Total = 0.045 dollars = 4.5 cents, ceil = 5
      expect(cost).toBe(5);
    });
    /* oxlint-enable oxc/no-async-await */
    /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
    it("should handle GPT-4o pricing", async () => {
      getAppModelDefinition.mockResolvedValue({
        pricing: { input: "0.0000025", output: "0.00001" },
      });
      const accumulator = new CostAccumulator();
      accumulator.addLLMCost(
        gatewayModelDefaults.workflows.chat,
        { inputTokens: 100_000, outputTokens: 10_000 },
        "test"
      );
      const cost = await accumulator.getTotalCost();
      // 100000 * 0.0000025 = 0.25 (input)
      // 10000 * 0.00001 = 0.1 (output)
      // Total = 0.35 dollars = 35 cents
      expect(cost).toBe(35);
    });
    /* oxlint-enable oxc/no-async-await */
    /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
    it("should skip models without pricing", async () => {
      getAppModelDefinition.mockResolvedValue({});
      const accumulator = new CostAccumulator();
      accumulator.addLLMCost(
        gatewayModelDefaults.workflows.chat,
        { inputTokens: 1000, outputTokens: 500 },
        "test"
      );
      const cost = await accumulator.getTotalCost();
      expect(cost).toBe(0);
    });
    /* oxlint-enable oxc/no-async-await */
  });
  describe("API cost tracking", () => {
    /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
    it("should add API costs", async () => {
      const accumulator = new CostAccumulator();
      accumulator.addAPICost("webSearch", 5);
      const cost = await accumulator.getTotalCost();
      expect(cost).toBe(5);
    });
    /* oxlint-enable oxc/no-async-await */
    it("should ignore zero API costs", () => {
      const accumulator = new CostAccumulator();
      accumulator.addAPICost("internal", 0);
      expect(accumulator.hasEntries()).toBe(false);
    });
  });
  describe("combined costs", () => {
    /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
    it("should sum LLM and API costs", async () => {
      const accumulator = new CostAccumulator();
      accumulator.addLLMCost(
        gatewayModelDefaults.workflows.chat,
        { inputTokens: 1000, outputTokens: 500 },
        "chat"
      );
      accumulator.addAPICost("webSearch", 5);
      const cost = await accumulator.getTotalCost();
      // LLM: 2.5 cents + API: 5 cents = 7.5, ceil = 8
      expect(cost).toBe(8);
    });
    /* oxlint-enable oxc/no-async-await */
    /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
    it("should accumulate multiple LLM calls", async () => {
      const accumulator = new CostAccumulator();
      accumulator.addLLMCost(
        gatewayModelDefaults.workflows.chat,
        { inputTokens: 1000, outputTokens: 500 },
        "main"
      );
      accumulator.addLLMCost(
        gatewayModelDefaults.workflows.chat,
        { inputTokens: 1000, outputTokens: 500 },
        "tool"
      );
      const cost = await accumulator.getTotalCost();
      // 2.5 + 2.5 = 5 cents
      expect(cost).toBe(5);
      expect(getAppModelDefinition).toHaveBeenCalledExactlyOnceWith(
        gatewayModelDefaults.workflows.chat
      );
    });
    /* oxlint-enable oxc/no-async-await */
  });
  describe("image cost tracking", () => {
    /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
    it("preserves recorded addition order before final cent rounding", async () => {
      fetchModels.mockResolvedValue([
        { id: "first-image", pricing: { image: "0.0085" } },
        { id: "second-image", pricing: { image: "0.0011" } },
      ]);
      const accumulator = new CostAccumulator();
      accumulator.addAPICost("base", 0.04);
      accumulator.addImageCost("first-image", 1, {}, "first");
      accumulator.addImageCost("second-image", 1, {}, "second");
      // Keep sequential floating-point additions: regrouping image costs
      // before adding the API subtotal would round this boundary to one cent.
      expect(await accumulator.getTotalCost()).toBe(2);
      expect(fetchModels).toHaveBeenCalledOnce();
    });
    /* oxlint-enable oxc/no-async-await */
    /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
    it("retains known charges when the image catalog lookup fails", async () => {
      fetchModels.mockRejectedValue(new Error("Catalog unavailable"));
      const accumulator = new CostAccumulator();
      accumulator.addAPICost("base", 5);
      accumulator.addImageCost("unknown-image", 1, {}, "image");
      accumulator.addLLMCost(
        gatewayModelDefaults.workflows.chat,
        { inputTokens: 1000 },
        "chat"
      );
      expect(await accumulator.getTotalCost()).toBe(6);
    });
    /* oxlint-enable oxc/no-async-await */
  });
  describe("getEntries", () => {
    it("should return copy of entries", () => {
      const accumulator = new CostAccumulator();
      accumulator.addAPICost("test", 5);
      const entries = accumulator.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0]).toEqual({ apiName: "test", cost: 5, type: "api" });
    });
  });
  describe("hasEntries", () => {
    it("should return false when empty", () => {
      const accumulator = new CostAccumulator();
      expect(accumulator.hasEntries()).toBe(false);
    });
    it("should return true when has entries", () => {
      const accumulator = new CostAccumulator();
      accumulator.addAPICost("test", 5);
      expect(accumulator.hasEntries()).toBe(true);
    });
  });
});
/* oxlint-enable max-lines-per-function, no-magic-numbers */
