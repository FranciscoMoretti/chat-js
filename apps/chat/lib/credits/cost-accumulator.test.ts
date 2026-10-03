/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../ai/gateway-model-defaults" dependency within this package instead of introducing an alias or barrel API.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { gatewayModelDefaults } from "../ai/gateway-model-defaults";
/* oxlint-enable import/no-relative-parent-imports */

const { getAppModelDefinition } = vi.hoisted(() => ({
  getAppModelDefinition:
    vi.fn<
      (
        modelId: string
      ) => Promise<{ pricing?: { input: string; output: string } }>
    >(),
}));

vi.mock("../ai/app-models", () => ({ getAppModelDefinition }));

beforeEach(() => {
  getAppModelDefinition.mockReset().mockResolvedValue({
    pricing: { input: "0.00001", output: "0.00003" },
  });
});

/* oxlint-disable node/no-top-level-await --
 * node/no-top-level-await (#539): { CostAccumulator } runs in the configured Bun/ESM entrypoint and must finish before following module work; do not introduce background initialization.
 */
const { CostAccumulator } = await import("./cost-accumulator");
/* oxlint-enable node/no-top-level-await */
/* oxlint-disable max-lines-per-function, no-magic-numbers, oxc/no-async-await --
 * max-lines-per-function (#510): describe("CostAccumulator") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): describe("CostAccumulator") uses 3, 0, 5, 35, 8, 1 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * oxc/no-async-await (#540): describe("CostAccumulator") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 */
describe("CostAccumulator", () => {
  describe("LLM cost calculation", () => {
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
    it("should handle undefined tokens as zero", async () => {
      const accumulator = new CostAccumulator();
      accumulator.addLLMCost(gatewayModelDefaults.workflows.chat, {}, "test");
      const cost = await accumulator.getTotalCost();
      expect(cost).toBe(0);
    });
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
  });
  describe("API cost tracking", () => {
    it("should add API costs", async () => {
      const accumulator = new CostAccumulator();
      accumulator.addAPICost("webSearch", 5);
      const cost = await accumulator.getTotalCost();
      expect(cost).toBe(5);
    });
    it("should ignore zero API costs", () => {
      const accumulator = new CostAccumulator();
      accumulator.addAPICost("internal", 0);
      expect(accumulator.hasEntries()).toBe(false);
    });
  });
  describe("combined costs", () => {
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
/* oxlint-enable max-lines-per-function, no-magic-numbers, oxc/no-async-await */
