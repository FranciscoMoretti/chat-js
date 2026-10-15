import type { LanguageModelV4 } from "@ai-sdk/provider";
import type { ModelCallScope } from "./model-ledger";
import { MockLanguageModelV4 } from "ai/test";
import { expect, it, vi } from "vitest";

import { generateEveFollowupSuggestions } from "./generate-followup-suggestions";

const model = new MockLanguageModelV4({
  doGenerate: vi.fn().mockResolvedValue({
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
const mocks = vi.hoisted(() => ({
  resolveEveModel: vi.fn(),
  begin: vi.fn(),
  finish: vi.fn(),
}));
vi.mock("./model-accounting", async () => {
  const { wrapEveModel } = await import("./model-ledger");
  return {
    accountEveModel: (
      resolved: { model: LanguageModelV4 },
      scope: ModelCallScope
    ) => ({
      ...resolved,
      model: wrapEveModel(resolved.model, scope, {
        begin: mocks.begin,
        finish: mocks.finish,
      }),
    }),
  };
});
vi.mock("./model-selection", () => ({
  resolveEveModel: mocks.resolveEveModel,
}));
// vi.mock factories are hoisted, but the resolved model is configured after this module initializes it.
mocks.resolveEveModel.mockResolvedValue({ model, modelOptions: {} });
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
  const result = await generateEveFollowupSuggestions(
    { assistant: "Because.", user: "Why?" },
    { ownerId: "owner", sessionId: "session", turnId: "turn" }
  );
  expect(result).toBeUndefined();
  expect(mocks.begin).toHaveBeenCalledOnce();
  expect(mocks.finish).toHaveBeenCalledWith(
    expect.objectContaining({
      ownerId: "owner",
      sessionId: "session",
      turnId: "turn",
    }),
    expect.objectContaining({
      providerMetadata: {
        gateway: { cost: "0.00001", generationId: "paid-invalid-output" },
      },
    })
  );
  expect(model.doGenerateCalls).toHaveLength(1);
});
