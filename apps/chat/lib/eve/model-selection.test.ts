import { MockLanguageModelV3 } from "ai/test";
import { expect, test, vi } from "vitest";

import {
  getEveModelDefinition,
  loadEveModelDefinition,
  resolveEveModel,
} from "./model-selection";

vi.mock("../ai/active-gateway", () => ({
  getActiveGateway: () => ({
    createLanguageModel: (id: string) =>
      new MockLanguageModelV3({
        doGenerate: () => Promise.reject(new Error(`provider model: ${id}`)),
        modelId: id,
        provider: "test",
      }),
    fetchModels: async () => {
      const { getFallbackModels } =
        await import("../ai/gateways/fallback-models");
      return [
        ...getFallbackModels("test"),
        { id: "live-only", pricing: {}, tags: [], type: "language" },
      ];
    },
  }),
}));
vi.mock("../config", () => ({
  config: {
    ai: {
      disabledModels: ["disabled"],
      gateway: "test",
      workflows: { chat: "plain" },
    },
  },
}));
vi.mock("../ai/gateways/fallback-models", () => ({
  getFallbackModels: () => [
    {
      context_window: 1000,
      id: "plain",
      owned_by: "openai",
      pricing: {},
      tags: [],
      type: "language",
    },
    {
      context_window: 2000,
      id: "thinking",
      owned_by: "anthropic",
      pricing: {},
      tags: ["reasoning"],
      type: "language",
    },
    { id: "disabled", pricing: {}, tags: [], type: "language" },
    { id: "image", pricing: {}, tags: [], type: "image" },
  ],
}));

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

test.each(["unknown", "disabled", "image", "plain-reasoning"])(
  "rejects unavailable selection %s",
  (id) => {
    expect(() => getEveModelDefinition(id)).toThrow("not available");
  }
);

test("accepts live catalog models absent from the snapshot", async () => {
  expect(() => getEveModelDefinition("live-only")).toThrow();
  expect(await loadEveModelDefinition("live-only")).toMatchObject({
    id: "live-only",
  });
});
