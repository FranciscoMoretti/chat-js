import type { LanguageModelUsage, ProviderMetadata } from "ai";
import { beforeEach, expect, it, vi } from "vitest";

import { generateEveFollowupSuggestions } from "./generate-followup-suggestions";

const mocks = vi.hoisted(() => ({
  feature: { default: "google/gemini-2.5-flash-lite", enabled: true },
  generate: vi.fn(),
  model: vi.fn(),
}));
vi.mock("ai", () => ({
  Output: { object: vi.fn() },
  generateText: mocks.generate,
}));
vi.mock("./model-selection", () => ({ resolveEveModel: mocks.model }));
vi.mock("../config", () => ({
  config: { ai: { tools: { followupSuggestions: mocks.feature } } },
}));

const evidence: {
  usage: Partial<LanguageModelUsage>;
  providerMetadata: ProviderMetadata;
} = {
  providerMetadata: {
    gateway: { cost: "0.00002", generationId: "generation" },
  },
  usage: { inputTokens: 10, outputTokens: 20 },
};
const exchange = {
  assistant: "Rain is liquid precipitation.",
  user: "What is rain?",
};
const suggestions = [
  "How do clouds form?",
  "Why do raindrops fall?",
  "How is rainfall measured?",
];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.feature.enabled = true;
  mocks.model.mockResolvedValue({
    model: { specificationVersion: "v3" },
    modelOptions: {},
  });
});

it("retains paid usage when structured output cannot be read", async () => {
  mocks.generate.mockImplementation(({ onStepFinish }) => {
    onStepFinish(evidence);
    return {
      get output() {
        throw new Error("Malformed suggestions");
      },
    };
  });
  const result = await generateEveFollowupSuggestions(exchange);
  expect(result?.responseMetadata).toBeUndefined();
  expect(result?.modelCalls).toEqual([
    { modelId: mocks.feature.default, ...evidence },
  ]);
  expect(mocks.generate).toHaveBeenCalledWith(
    expect.objectContaining({ maxOutputTokens: 512, maxRetries: 0 })
  );
});

it("returns valid suggestions and records the configured auxiliary model", async () => {
  mocks.generate.mockImplementation(({ onStepFinish }) => {
    onStepFinish(evidence);
    return { output: { suggestions } };
  });
  expect(await generateEveFollowupSuggestions(exchange)).toEqual({
    modelCalls: [{ modelId: mocks.feature.default, ...evidence }],
    responseMetadata: { suggestions },
  });
  expect(mocks.model).toHaveBeenCalledWith(mocks.feature.default);
});

it("records a failed attempt without turning an optional feature error into answer failure", async () => {
  mocks.generate.mockRejectedValue(new Error("Provider unavailable"));
  expect(await generateEveFollowupSuggestions(exchange)).toEqual({
    modelCalls: [{ failed: true, modelId: mocks.feature.default }],
  });
});

it("does not spend when disabled, without an answer, or before model resolution succeeds", async () => {
  mocks.feature.enabled = false;
  expect(await generateEveFollowupSuggestions(exchange)).toBeUndefined();
  mocks.feature.enabled = true;
  expect(
    await generateEveFollowupSuggestions({ ...exchange, assistant: "" })
  ).toBeUndefined();
  mocks.model.mockRejectedValue(new Error("Model configuration unavailable"));
  expect(await generateEveFollowupSuggestions(exchange)).toEqual({
    modelCalls: [],
  });
  expect(mocks.generate).not.toHaveBeenCalled();
});
