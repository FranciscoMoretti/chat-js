import type { LanguageModelV4 } from "@ai-sdk/provider";
import type { ModelCallScope } from "./model-ledger";
import { MockLanguageModelV4 } from "ai/test";
import { beforeEach, expect, it, vi } from "vitest";

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
  authorize: vi.fn(),
  begin: vi.fn(),
  finish: vi.fn(),
  logError: vi.fn(),
  claim: vi.fn(),
  finishSuggestions: vi.fn(),
}));
vi.mock("../db/queries", () => ({
  claimEveFollowup: mocks.claim,
  finishEveFollowup: mocks.finishSuggestions,
}));
vi.mock("../logger", () => ({
  createModuleLogger: () => ({ error: mocks.logError }),
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
        authorize: mocks.authorize,
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
beforeEach(() => {
  vi.clearAllMocks();
  mocks.claim.mockResolvedValue("chat");
  mocks.finishSuggestions.mockResolvedValue(null);
  mocks.resolveEveModel.mockResolvedValue({ model, modelOptions: {} });
  mocks.begin.mockReset();
  mocks.finish.mockReset();
});
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
  await generateEveFollowupSuggestions(
    { assistant: "Because.", user: "Why?" },
    {
      ownerId: "owner",
      sessionId: "session",
      turnId: "turn",
      eventId: "completion",
    }
  );
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

it("leaves a rejected provider attempt unpriced without retrying or inventing a receipt", async () => {
  const failedModel = new MockLanguageModelV4({
    doGenerate: vi.fn().mockRejectedValue(new Error("provider unavailable")),
  });
  mocks.resolveEveModel.mockResolvedValue({
    model: failedModel,
    modelOptions: {},
  });
  await generateEveFollowupSuggestions(
    { assistant: "Because.", user: "Why?" },
    {
      ownerId: "owner",
      sessionId: "session",
      turnId: "turn",
      eventId: "completion",
    }
  );
  expect(mocks.begin).toHaveBeenCalledOnce();
  expect(mocks.finish).not.toHaveBeenCalled();
  expect(failedModel.doGenerateCalls).toHaveLength(1);
});

it("returns valid suggestions despite a failed receipt write", async () => {
  mocks.finish.mockRejectedValue(new Error("receipt storage unavailable"));
  const suggestions = [
    "What comes next?",
    "Why does that happen?",
    "Can you explain more?",
  ];
  const successfulModel = new MockLanguageModelV4({
    doGenerate: vi.fn().mockResolvedValue({
      content: [{ text: JSON.stringify({ suggestions }), type: "text" }],
      finishReason: { raw: "stop", unified: "stop" },
      providerMetadata: { gateway: { cost: "0.001" } },
      usage: {
        inputTokens: { total: 1, noCache: 1 },
        outputTokens: { total: 1, text: 1 },
      },
      warnings: [],
    }),
  });
  mocks.resolveEveModel.mockResolvedValue({
    model: successfulModel,
    modelOptions: {},
  });
  await generateEveFollowupSuggestions(
    { assistant: "Because.", user: "Why?" },
    {
      ownerId: "owner",
      sessionId: "session",
      turnId: "turn",
      eventId: "completion",
    }
  );
  expect(mocks.finishSuggestions).toHaveBeenCalledWith(
    "owner",
    "chat",
    "completion",
    suggestions
  );
  expect(successfulModel.doGenerateCalls).toHaveLength(1);
  expect(mocks.finish).toHaveBeenCalledOnce();
  expect(mocks.logError).toHaveBeenCalledWith(
    expect.objectContaining({
      errorType: "error",
      stage: "receipt",
      sessionId: "session",
      turnId: "turn",
    }),
    "Eve accounting requires review"
  );
});
