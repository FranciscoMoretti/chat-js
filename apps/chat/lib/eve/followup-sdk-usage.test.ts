import { MockLanguageModelV3 } from "ai/test";
import { expect, it, vi } from "vitest";

import { generateEveFollowupSuggestions } from "./generate-followup-suggestions";

const model = new MockLanguageModelV3({
  doGenerate: () =>
    Promise.resolve({
      content: [{ text: "This is not valid JSON", type: "text" }],
      finishReason: { raw: "stop", unified: "stop" },
      providerMetadata: {
        gateway: { cost: "0.00001", generationId: "paid-invalid-output" },
      },
      usage: {
        inputTokens: { cacheRead: 0, cacheWrite: 0, noCache: 20, total: 20 },
        outputTokens: { reasoning: 0, text: 10, total: 10 },
      },
      warnings: [],
    }),
});
vi.mock("./model-selection", () => ({
  resolveEveModel: () => Promise.resolve({ model, modelOptions: {} }),
}));
vi.mock("../config", () => ({
  config: {
    ai: {
      tools: {
        followupSuggestions: {
          default: "google/gemini-2.5-flash-lite",
          enabled: true,
        },
      },
    },
  },
}));

it("the real AI SDK delivers usage before rejecting invalid structured suggestions", async () => {
  const result = await generateEveFollowupSuggestions({
    assistant: "Because.",
    user: "Why?",
  });
  expect(result?.responseMetadata).toBeUndefined();
  expect(result?.modelCalls).toHaveLength(1);
  expect(result?.modelCalls?.[0]).toMatchObject({
    modelId: "google/gemini-2.5-flash-lite",
    providerMetadata: {
      gateway: { cost: "0.00001", generationId: "paid-invalid-output" },
    },
    usage: { inputTokens: 20, outputTokens: 10 },
  });
  expect(result?.modelCalls?.[0].failed).toBeUndefined();
  expect(model.doGenerateCalls).toHaveLength(1);
});
