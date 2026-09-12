import type { LanguageModelUsage, ProviderMetadata } from "ai";
import { beforeEach, expect, it, vi } from "vitest";
import { generateEveFollowupSuggestions } from "./generate-followup-suggestions";

const mocks = vi.hoisted(() => ({
  generate: vi.fn(),
  model: vi.fn(),
  feature: { enabled: true, default: "google/gemini-2.5-flash-lite" },
}));
vi.mock("ai", () => ({
  generateText: mocks.generate,
  Output: { object: vi.fn() },
}));
vi.mock("./model-selection", () => ({ resolveEveModel: mocks.model }));
vi.mock("../config", () => ({
  config: { ai: { tools: { followupSuggestions: mocks.feature } } },
}));

const evidence: {
  usage: Partial<LanguageModelUsage>;
  providerMetadata: ProviderMetadata;
} = {
  usage: { inputTokens: 10, outputTokens: 20 },
  providerMetadata: {
    gateway: { cost: "0.00002", generationId: "generation" },
  },
};
const exchange = {
  user: "What is rain?",
  assistant: "Rain is liquid precipitation.",
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
    expect.objectContaining({ maxRetries: 0, maxOutputTokens: 512 })
  );
});

it("returns valid suggestions and records the configured auxiliary model", async () => {
  mocks.generate.mockImplementation(({ onStepFinish }) => {
    onStepFinish(evidence);
    return { output: { suggestions } };
  });
  expect(await generateEveFollowupSuggestions(exchange)).toEqual({
    responseMetadata: { suggestions },
    modelCalls: [{ modelId: mocks.feature.default, ...evidence }],
  });
  expect(mocks.model).toHaveBeenCalledWith(mocks.feature.default);
});

it("records a failed attempt without turning an optional feature error into answer failure", async () => {
  mocks.generate.mockRejectedValue(new Error("Provider unavailable"));
  expect(await generateEveFollowupSuggestions(exchange)).toEqual({
    modelCalls: [{ modelId: mocks.feature.default, failed: true }],
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
