import type { LanguageModelUsage, ProviderMetadata } from "ai";
import { beforeEach, expect, it, vi } from "vitest";
import { generateEveFollowupSuggestions } from "./generate-followup-suggestions";

interface UsageEvidence {
  readonly usage: Readonly<
    Pick<LanguageModelUsage, "inputTokens" | "outputTokens">
  >;
  readonly providerMetadata: {
    readonly gateway: { readonly cost: string; readonly generationId: string };
  };
}

const mocks = vi.hoisted(() => ({
  feature: { default: "google/gemini-2.5-flash-lite", enabled: true },
  generate: vi.fn<
    (options: { readonly onStepEnd: (step: UsageEvidence) => void }) => {
      readonly output: { readonly suggestions: readonly string[] };
    }
  >(),
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

const evidence = {
  providerMetadata: {
    gateway: { cost: "0.00002", generationId: "generation" },
  },
  usage: { inputTokens: 10, outputTokens: 20 },
} satisfies {
  usage: Partial<LanguageModelUsage>;
  providerMetadata: ProviderMetadata;
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

/* oxlint-disable oxc/no-async-await -- Await auxiliary generation before checking its usage receipts, parsed suggestions and provider spies. */

it("retains paid usage when structured output cannot be read", async () => {
  mocks.generate.mockImplementation(({ onStepEnd }) => {
    onStepEnd(evidence);
    return {
      get output(): never {
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
/* oxlint-disable oxc/no-async-await -- Await auxiliary generation before checking its usage receipts, parsed suggestions and provider spies. */

it("returns valid suggestions and records the configured auxiliary model", async () => {
  mocks.generate.mockImplementation(({ onStepEnd }) => {
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
/* oxlint-disable oxc/no-async-await -- Await auxiliary generation before checking its usage receipts, parsed suggestions and provider spies. */
it("records a failed attempt without turning an optional feature error into answer failure", async () => {
  mocks.generate.mockRejectedValue(new Error("Provider unavailable"));
  expect(await generateEveFollowupSuggestions(exchange)).toEqual({
    modelCalls: [{ failed: true, modelId: mocks.feature.default }],
  });
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Await auxiliary generation before checking its usage receipts, parsed suggestions and provider spies. */
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
