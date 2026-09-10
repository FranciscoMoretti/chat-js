import { MockLanguageModelV3 } from "ai/test";
import { expect, test, vi } from "vitest";

vi.mock("../ai/active-gateway", () => ({
  getActiveGateway: () => ({
    fetchModels: async () => {
      const { getFallbackModels } = await import(
        "../ai/gateways/fallback-models"
      );
      return [
        ...getFallbackModels("test"),
        { id: "live-only", type: "language", tags: [], pricing: {} },
      ];
    },
    createLanguageModel: (id: string) =>
      new MockLanguageModelV3({
        modelId: id,
        provider: "test",
        doGenerate: () => Promise.reject(new Error(`provider model: ${id}`)),
      }),
  }),
}));
vi.mock("../config", () => ({
  config: {
    ai: {
      gateway: "test",
      disabledModels: ["disabled"],
      workflows: { chat: "plain" },
    },
  },
}));
vi.mock("../ai/gateways/fallback-models", () => ({
  getFallbackModels: () => [
    {
      id: "plain",
      type: "language",
      tags: [],
      context_window: 1000,
      pricing: {},
      owned_by: "openai",
    },
    {
      id: "thinking",
      type: "language",
      tags: ["reasoning"],
      context_window: 2000,
      pricing: {},
      owned_by: "anthropic",
    },
    { id: "disabled", type: "language", tags: [], pricing: {} },
    { id: "image", type: "image", tags: [], pricing: {} },
  ],
}));

import {
  getEveModelDefinition,
  loadEveModelDefinition,
  resolveEveModel,
} from "./model-selection";

test("keeps the provider model and reasoning variant distinct", async () => {
  expect(getEveModelDefinition()).toMatchObject({
    id: "plain",
    reasoning: false,
  });
  expect(getEveModelDefinition("thinking").reasoning).toBe(false);
  expect(getEveModelDefinition("thinking-reasoning")).toMatchObject({
    apiModelId: "thinking",
    reasoning: true,
  });
  expect(await resolveEveModel("thinking-reasoning")).toMatchObject({
    model: { modelId: "thinking-reasoning" },
    modelContextWindowTokens: 2000,
    modelOptions: {
      providerOptions: { anthropic: { thinking: { type: "enabled" } } },
    },
  });
});
test("the logical reasoning identity still dispatches to the original provider model", async () => {
  const resolved = await resolveEveModel("thinking-reasoning");
  await expect(resolved.model.doGenerate({ prompt: [] })).rejects.toThrow(
    "provider model: thinking"
  );
});

test.each([
  "unknown",
  "disabled",
  "image",
  "plain-reasoning",
])("rejects unavailable selection %s", (id) => {
  expect(() => getEveModelDefinition(id)).toThrow("not available");
});

test("accepts live catalog models absent from the snapshot", async () => {
  expect(() => getEveModelDefinition("live-only")).toThrow();
  expect(await loadEveModelDefinition("live-only")).toMatchObject({
    id: "live-only",
  });
});
