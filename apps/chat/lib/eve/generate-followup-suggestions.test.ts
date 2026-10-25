import { beforeEach, expect, it, vi } from "vitest";
import { generateEveFollowupSuggestions } from "@/plugins/followup-suggestions/generate-suggestions";

const mocks = vi.hoisted(() => ({
  feature: { default: "mock", enabled: true },
  generate: vi.fn(),
  model: vi.fn(),
  account: vi.fn(),
  logError: vi.fn(),
  claim: vi.fn(),
  finishSuggestions: vi.fn(),
}));
vi.mock("@/plugins/followup-suggestions/followup-queries", () => ({
  claimEveFollowup: mocks.claim,
  finishEveFollowup: mocks.finishSuggestions,
}));
vi.mock("ai", () => ({
  Output: { object: vi.fn() },
  generateText: mocks.generate,
}));
vi.mock("./model-selection", () => ({ resolveEveModel: mocks.model }));
vi.mock("./model-accounting", () => ({ accountEveModel: mocks.account }));
vi.mock("../logger", () => ({
  createModuleLogger: () => ({ error: mocks.logError }),
}));
vi.mock("../config", () => ({
  config: { ai: { tools: { followupSuggestions: mocks.feature } } },
}));
const exchange = {
  assistant: "Rain is liquid precipitation.",
  user: "What is rain?",
};
const scope = {
  ownerId: "owner",
  sessionId: "session",
  turnId: "turn",
  eventId: "completion",
};
const suggestions = [
  "How do clouds form?",
  "Why do raindrops fall?",
  "How is rainfall measured?",
];
beforeEach(() => {
  vi.clearAllMocks();
  mocks.claim.mockResolvedValue("chat");
  mocks.finishSuggestions.mockResolvedValue(null);
  mocks.feature.enabled = true;
  mocks.model.mockResolvedValue({ model: "unwrapped" });
  mocks.account.mockReturnValue({ model: "accounted", modelOptions: {} });
});
it("persists suggestions under the exact completion and uses owned accounting", async () => {
  mocks.generate.mockResolvedValue({ output: { suggestions } });
  await generateEveFollowupSuggestions(exchange, scope);
  expect(mocks.finishSuggestions).toHaveBeenCalledWith(
    "owner",
    "chat",
    "completion",
    suggestions
  );
  expect(mocks.account).toHaveBeenCalledWith({ model: "unwrapped" }, scope);
  expect(mocks.generate).toHaveBeenCalledWith(
    expect.objectContaining({ model: "accounted", maxRetries: 0 })
  );
});
it("reports auxiliary failure without failing the answer or logging provider details", async () => {
  mocks.generate.mockRejectedValue(new Error("Provider unavailable"));
  await generateEveFollowupSuggestions(exchange, scope);
  expect(mocks.logError).toHaveBeenCalledWith(
    {
      errorType: "Error",
      sessionId: "session",
      turnId: "turn",
      eventId: "completion",
    },
    "Follow-up generation or storage failed"
  );
});
it("does not call a provider when disabled, empty, or accounting binding fails", async () => {
  mocks.feature.enabled = false;
  await generateEveFollowupSuggestions(exchange, scope);
  mocks.feature.enabled = true;
  await generateEveFollowupSuggestions({ ...exchange, assistant: "" }, scope);
  mocks.account.mockImplementation(() => {
    throw new Error("unprepared");
  });
  await generateEveFollowupSuggestions(exchange, scope);
  expect(mocks.generate).not.toHaveBeenCalled();
});

it("does not generate again after a durable claim, including an interrupted attempt", async () => {
  mocks.claim.mockResolvedValueOnce(null);
  await generateEveFollowupSuggestions(exchange, scope);
  expect(mocks.generate).not.toHaveBeenCalled();
  expect(mocks.model).not.toHaveBeenCalled();
});

it("does not make a paid call when the durable claim cannot be written", async () => {
  mocks.claim.mockRejectedValueOnce(new Error("database unavailable"));
  await generateEveFollowupSuggestions(exchange, scope);
  expect(mocks.generate).not.toHaveBeenCalled();
  expect(mocks.logError).toHaveBeenCalledOnce();
});
