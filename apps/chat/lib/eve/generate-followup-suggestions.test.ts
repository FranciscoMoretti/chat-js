import { beforeEach, expect, it, vi } from "vitest";
import { generateEveFollowupSuggestions } from "./generate-followup-suggestions";

const mocks = vi.hoisted(() => ({
  feature: { default: "mock", enabled: true },
  generate: vi.fn(),
  model: vi.fn(),
  account: vi.fn(),
}));
vi.mock("ai", () => ({
  Output: { object: vi.fn() },
  generateText: mocks.generate,
}));
vi.mock("./model-selection", () => ({ resolveEveModel: mocks.model }));
vi.mock("./model-accounting", () => ({ accountEveModel: mocks.account }));
vi.mock("../config", () => ({
  config: { ai: { tools: { followupSuggestions: mocks.feature } } },
}));
const exchange = {
  assistant: "Rain is liquid precipitation.",
  user: "What is rain?",
};
const scope = { ownerId: "owner", sessionId: "session", turnId: "turn" };
const suggestions = [
  "How do clouds form?",
  "Why do raindrops fall?",
  "How is rainfall measured?",
];
beforeEach(() => {
  vi.clearAllMocks();
  mocks.feature.enabled = true;
  mocks.model.mockResolvedValue({ model: "unwrapped" });
  mocks.account.mockResolvedValue({ model: "accounted", modelOptions: {} });
});
it("uses an owned accounting wrapper and returns only display metadata", async () => {
  mocks.generate.mockResolvedValue({ output: { suggestions } });
  expect(await generateEveFollowupSuggestions(exchange, scope)).toEqual({
    responseMetadata: { suggestions },
  });
  expect(mocks.account).toHaveBeenCalledWith({ model: "unwrapped" }, scope);
  expect(mocks.generate).toHaveBeenCalledWith(
    expect.objectContaining({ model: "accounted", maxRetries: 0 })
  );
});
it("does not fail the answer or manufacture a zero price on auxiliary failure", async () => {
  mocks.generate.mockRejectedValue(new Error("Provider unavailable"));
  expect(await generateEveFollowupSuggestions(exchange, scope)).toBeUndefined();
});
it("does not call a provider when disabled, empty, or accounting binding fails", async () => {
  mocks.feature.enabled = false;
  expect(await generateEveFollowupSuggestions(exchange, scope)).toBeUndefined();
  mocks.feature.enabled = true;
  expect(
    await generateEveFollowupSuggestions({ ...exchange, assistant: "" }, scope)
  ).toBeUndefined();
  mocks.account.mockRejectedValue(new Error("unprepared"));
  expect(await generateEveFollowupSuggestions(exchange, scope)).toBeUndefined();
  expect(mocks.generate).not.toHaveBeenCalled();
});
