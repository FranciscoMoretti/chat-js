import { beforeEach, expect, it, vi } from "vitest";

import {
  EVE_TITLE_MAX_LENGTH,
  eveConversationTitleFallback,
  generateEveConversationTitleResult,
  persistGeneratedEveConversationTitle,
} from "./conversation-title";

const mocks = vi.hoisted(() => ({
  generate: vi.fn(),
  model: vi.fn(),
  pending: vi.fn(),
  replace: vi.fn(),
  settle: vi.fn(),
}));

vi.mock("ai", () => ({ generateText: mocks.generate }));
vi.mock("@/lib/ai/providers", () => ({ getLanguageModel: mocks.model }));
vi.mock("@/lib/ai/telemetry", () => ({ chatTelemetry: "telemetry" }));
vi.mock("@/lib/config", () => ({
  config: { ai: { workflows: { title: "openai/gpt-5-nano" } } },
}));
vi.mock("@/lib/db/eve-queries", () => ({
  isEveRootTitlePending: mocks.pending,
  replaceEveRootFallbackTitle: mocks.replace,
  settleEveRootFallbackTitle: mocks.settle,
}));
vi.mock("@/lib/logger", () => ({
  createModuleLogger: () => ({ warn: vi.fn() }),
}));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.model.mockResolvedValue("title-model");
  mocks.pending.mockResolvedValue(true);
});

it("uses the configured ChatJS title model for a concise title", async () => {
  mocks.generate.mockResolvedValue({ text: "Plan A Weekend In Lisbon" });

  await expect(
    generateEveConversationTitleResult(
      "Plan a weekend trip to Lisbon with food"
    )
  ).resolves.toEqual({
    source: "generated",
    title: "Plan A Weekend In Lisbon",
  });
  expect(mocks.model).toHaveBeenCalledWith("openai/gpt-5-nano");
  expect(mocks.generate).toHaveBeenCalledWith(
    expect.objectContaining({
      maxRetries: 0,
      model: "title-model",
      telemetry: { integrations: "telemetry", isEnabled: true },
    })
  );
});

it("keeps a compact fallback when the provider is unavailable", async () => {
  mocks.generate.mockRejectedValue(new Error("provider unavailable"));
  const message =
    "Explain the practical differences between server actions and route handlers in a production Next.js app";

  await expect(generateEveConversationTitleResult(message)).resolves.toEqual({
    source: "fallback",
    title: eveConversationTitleFallback(message),
  });
  expect(eveConversationTitleFallback(message).length).toBeLessThanOrEqual(
    EVE_TITLE_MAX_LENGTH
  );
  await expect(generateEveConversationTitleResult(message)).resolves.toEqual({
    source: "fallback",
    title: eveConversationTitleFallback(message),
  });
});

it("normalizes overlong provider output before persisting it", async () => {
  mocks.generate.mockResolvedValue({
    text: '"A Very Long Generated Title That Cannot Fit In The Conversation List"',
  });

  const { title } = await generateEveConversationTitleResult("message");

  expect(title.length).toBeLessThanOrEqual(EVE_TITLE_MAX_LENGTH);
  expect(title).not.toMatch(/["']|[,:;.?!]$/u);
});

it("writes only a successful generated title through the canonical root update", async () => {
  mocks.generate.mockResolvedValue({ text: "Compare Server Rendering" });

  await expect(
    persistGeneratedEveConversationTitle({
      conversationId: "conversation-id",
      message: "Compare server rendering strategies",
      ownerId: "owner-id",
    })
  ).resolves.toEqual({
    source: "generated",
    title: "Compare Server Rendering",
  });
  expect(mocks.replace).toHaveBeenCalledWith(
    "owner-id",
    "conversation-id",
    "Compare server rendering strategies",
    "Compare Server Rendering"
  );
});

it("does not mark a fallback as generated when the provider fails", async () => {
  mocks.generate.mockRejectedValue(new Error("provider unavailable"));

  await persistGeneratedEveConversationTitle({
    conversationId: "conversation-id",
    message: "A message that stays a fallback title",
    ownerId: "owner-id",
  });

  expect(mocks.replace).not.toHaveBeenCalled();
  expect(mocks.settle).toHaveBeenCalledWith(
    "owner-id",
    "conversation-id",
    "A message that stays a fallback title"
  );
});

it("contains persistence failures after a title has been generated", async () => {
  mocks.generate.mockResolvedValue({ text: "Generated Title" });
  mocks.replace.mockRejectedValue(new Error("database unavailable"));

  await expect(
    persistGeneratedEveConversationTitle({
      conversationId: "conversation-id",
      message: "message",
      ownerId: "owner-id",
    })
  ).resolves.toEqual({ source: "generated", title: "Generated Title" });
});

it("does not spend a title generation after the canonical title settles", async () => {
  mocks.pending.mockResolvedValue(false);

  await persistGeneratedEveConversationTitle({
    conversationId: "conversation-id",
    message: "message",
    ownerId: "owner-id",
  });

  expect(mocks.generate).not.toHaveBeenCalled();
  expect(mocks.replace).not.toHaveBeenCalled();
  expect(mocks.settle).not.toHaveBeenCalled();
});
