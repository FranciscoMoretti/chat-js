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

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable typescript/explicit-function-return-type --
 * typescript/explicit-function-return-type (#560): Keep it("retains paid usage when structured output cannot be read")'s return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 */
it("retains paid usage when structured output cannot be read", async () => {
  mocks.generate.mockImplementation(({ onStepEnd }) => {
    // oxlint-disable-next-line typescript/no-unsafe-call -- #596: This generate-followup-suggestions fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration.
    onStepEnd(evidence);
    return {
      get output() {
        throw new Error("Malformed suggestions");
      },
    };
  });
  const result = await generateEveFollowupSuggestions(exchange);
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading responseMetadata from result; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
  expect(result?.responseMetadata).toBeUndefined();
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading modelCalls from result; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
  expect(result?.modelCalls).toEqual([
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing evidence own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    { modelId: mocks.feature.default, ...evidence },
  ]);
  expect(mocks.generate).toHaveBeenCalledWith(
    expect.objectContaining({ maxOutputTokens: 512, maxRetries: 0 })
  );
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable typescript/explicit-function-return-type */

it("returns valid suggestions and records the configured auxiliary model", async () => {
  mocks.generate.mockImplementation(({ onStepEnd }) => {
    // oxlint-disable-next-line typescript/no-unsafe-call -- #596: This generate-followup-suggestions fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration.
    onStepEnd(evidence);
    return { output: { suggestions } };
  });
  expect(await generateEveFollowupSuggestions(exchange)).toEqual({
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing evidence own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    modelCalls: [{ modelId: mocks.feature.default, ...evidence }],
    responseMetadata: { suggestions },
  });
  expect(mocks.model).toHaveBeenCalledWith(mocks.feature.default);
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
it("records a failed attempt without turning an optional feature error into answer failure", async () => {
  mocks.generate.mockRejectedValue(new Error("Provider unavailable"));
  expect(await generateEveFollowupSuggestions(exchange)).toEqual({
    modelCalls: [{ failed: true, modelId: mocks.feature.default }],
  });
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
it("does not spend when disabled, without an answer, or before model resolution succeeds", async () => {
  mocks.feature.enabled = false;
  expect(await generateEveFollowupSuggestions(exchange)).toBeUndefined();
  mocks.feature.enabled = true;
  expect(
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing exchange own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    await generateEveFollowupSuggestions({ ...exchange, assistant: "" })
  ).toBeUndefined();
  mocks.model.mockRejectedValue(new Error("Model configuration unavailable"));
  expect(await generateEveFollowupSuggestions(exchange)).toEqual({
    modelCalls: [],
  });
  expect(mocks.generate).not.toHaveBeenCalled();
});
/* oxlint-enable oxc/no-async-await */
