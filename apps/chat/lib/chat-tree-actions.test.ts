import { describe, expect, it } from "vitest";
import type { ChatMessage } from "@/lib/ai/types";
import {
  getRetryMessageInput,
  removeTrailingAssistantMessage,
} from "./chat-tree-actions";

function message({
  id,
  parentMessageId = null,
  role,
  selectedModel = "openai/gpt-5-mini",
}: {
  id: string;
  parentMessageId?: string | null;
  role: "assistant" | "user";
  selectedModel?: ChatMessage["metadata"]["selectedModel"];
}): ChatMessage {
  return {
    id,
    role,
    parts: [{ type: "text", text: id }],
    metadata: {
      activeStreamId: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      parentMessageId,
      selectedModel,
    },
  } as ChatMessage;
}

describe("getRetryMessageInput", () => {
  it("builds a retry message from an assistant response and keeps the parent user visible", () => {
    const root = message({ id: "root", role: "user" });
    const assistant = message({
      id: "assistant",
      parentMessageId: root.id,
      role: "assistant",
      selectedModel: "openai/gpt-5-nano",
    });

    const result = getRetryMessageInput({
      messageId: assistant.id,
      messages: [root, assistant],
    });

    expect(result).toMatchObject({
      ok: true,
      messagesBeforeRetry: [root],
      message: {
        id: root.id,
        role: "user",
        metadata: {
          activeStreamId: null,
          isPrimaryParallel: null,
          parallelGroupId: null,
          parallelIndex: null,
          parentMessageId: null,
          selectedModel: "openai/gpt-5-nano",
        },
      },
      selectedModelId: "openai/gpt-5-nano",
    });
  });

  it("uses the previous message as parent when metadata has no parent id", () => {
    const root = message({ id: "root", role: "user" });
    const assistant = message({ id: "assistant", role: "assistant" });

    const result = getRetryMessageInput({
      messageId: assistant.id,
      messages: [root, assistant],
    });

    expect(result.ok).toBe(true);
    expect(result.ok ? result.message.id : null).toBe(root.id);
  });

  it("reports missing parent messages", () => {
    const assistant = message({
      id: "assistant",
      parentMessageId: "missing",
      role: "assistant",
    });

    expect(
      getRetryMessageInput({ messageId: assistant.id, messages: [assistant] })
    ).toEqual({ ok: false, reason: "parent_not_found" });
  });
});

describe("removeTrailingAssistantMessage", () => {
  it("removes a trailing assistant message", () => {
    const root = message({ id: "root", role: "user" });
    const assistant = message({ id: "assistant", role: "assistant" });

    expect(removeTrailingAssistantMessage([root, assistant])).toEqual([root]);
  });

  it("preserves messages when the last message is not an assistant", () => {
    const messages = [message({ id: "root", role: "user" })];

    expect(removeTrailingAssistantMessage(messages)).toBe(messages);
  });
});
