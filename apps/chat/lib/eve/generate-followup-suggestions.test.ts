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

/* oxlint-disable typescript/explicit-function-return-type  --
 * oxc/no-async-await (#540): it("retains paid usage when structured output cannot be read") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * oxc/no-optional-chaining (#542): it("retains paid usage when structured output cannot be read") handles optional result?.responseMetadata; result?.modelCalls without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
 * oxc/no-rest-spread-properties (#543): it("retains paid usage when structured output cannot be read") copies or separates ...evidence while preserving existing object ownership; mutating source objects is not equivalent.
 * typescript/explicit-function-return-type (#560): Keep it("retains paid usage when structured output cannot be read")'s return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 */
it("retains paid usage when structured output cannot be read", async () => {
  mocks.generate.mockImplementation(({ onStepFinish }) => {
    // oxlint-disable-next-line typescript/no-unsafe-call -- #596: This generate-followup-suggestions fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration.
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
/* oxlint-enable typescript/explicit-function-return-type */

it("returns valid suggestions and records the configured auxiliary model", async () => {
  mocks.generate.mockImplementation(({ onStepFinish }) => {
    // oxlint-disable-next-line typescript/no-unsafe-call -- #596: This generate-followup-suggestions fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration.
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
