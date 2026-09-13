import { MockLanguageModelV3 } from "ai/test";
import { expect, it, vi } from "vitest";

import { generateEveFollowupSuggestions } from "./generate-followup-suggestions";

const model = new MockLanguageModelV3({
  doGenerate: async () => ({
    content: [{ type: "text", text: "This is not valid JSON" }],
    finishReason: { unified: "stop", raw: "stop" },
    usage: {
      inputTokens: { total: 20, noCache: 20, cacheRead: 0, cacheWrite: 0 },
      outputTokens: { total: 10, text: 10, reasoning: 0 },
    },
    warnings: [],
    providerMetadata: {
      gateway: { cost: "0.00001", generationId: "paid-invalid-output" },
    },
  }),
});
vi.mock("./model-selection", () => ({
  resolveEveModel: async () => ({ model, modelOptions: {} }),
}));
vi.mock("../config", () => ({
  config: {
    ai: {
      tools: {
        followupSuggestions: {
          enabled: true,
          default: "google/gemini-2.5-flash-lite",
        },
      },
    },
  },
}));

it("the real AI SDK delivers usage before rejecting invalid structured suggestions", async () => {
  const result = await generateEveFollowupSuggestions({
    user: "Why?",
    assistant: "Because.",
  });
  expect(result?.responseMetadata).toBeUndefined();
  expect(result?.modelCalls).toHaveLength(1);
  expect(result?.modelCalls?.[0]).toMatchObject({
    modelId: "google/gemini-2.5-flash-lite",
    usage: { inputTokens: 20, outputTokens: 10 },
    providerMetadata: {
      gateway: { generationId: "paid-invalid-output", cost: "0.00001" },
    },
  });
  expect(result?.modelCalls?.[0].failed).toBeUndefined();
  expect(model.doGenerateCalls).toHaveLength(1);
});
