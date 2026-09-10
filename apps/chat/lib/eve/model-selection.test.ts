import { expect, test, vi } from "vitest";

vi.mock("../ai/active-gateway", () => ({
  getActiveGateway: () => ({
    createLanguageModel: (id: string) => ({ modelId: id }),
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

import { getEveModelDefinition, resolveEveModel } from "./model-selection";

test("keeps the provider model and reasoning variant distinct", () => {
  expect(getEveModelDefinition()).toMatchObject({
    id: "plain",
    reasoning: false,
  });
  expect(getEveModelDefinition("thinking").reasoning).toBe(false);
  expect(getEveModelDefinition("thinking-reasoning")).toMatchObject({
    apiModelId: "thinking",
    reasoning: true,
  });
  expect(resolveEveModel("thinking-reasoning")).toMatchObject({
    modelContextWindowTokens: 2000,
    modelOptions: {
      providerOptions: { anthropic: { thinking: { type: "enabled" } } },
    },
  });
});
test.each([
  "unknown",
  "disabled",
  "image",
  "plain-reasoning",
])("rejects unavailable selection %s", (id) => {
  expect(() => getEveModelDefinition(id)).toThrow("not available");
});
