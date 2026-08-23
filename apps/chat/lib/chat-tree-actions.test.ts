import { describe, expect, it } from "vitest";
import type { ChatMessage } from "@/lib/ai/types";
import { getRetryMessageInput } from "./chat-tree-actions";

function message({
  id,
  isPrimaryParallel = null,
  parallelGroupId = null,
  parallelIndex = null,
  parentMessageId = null,
  role,
  selectedModel = "openai/gpt-5-mini",
}: {
  id: string;
  isPrimaryParallel?: boolean | null;
  parallelGroupId?: string | null;
  parallelIndex?: number | null;
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
      isPrimaryParallel,
      parallelGroupId,
      parallelIndex,
      parentMessageId,
      selectedModel,
    },
  } as ChatMessage;
}

describe("getRetryMessageInput", () => {
  it("selects the response model for an assistant retry", () => {
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
      selectedModelId: "openai/gpt-5-nano",
    });
  });

  it("preserves the parallel response slot for an assistant retry", () => {
    const root = message({ id: "root", role: "user" });
    const assistant = message({
      id: "assistant",
      isPrimaryParallel: false,
      parallelGroupId: "group-1",
      parallelIndex: 1,
      parentMessageId: root.id,
      role: "assistant",
    });

    const result = getRetryMessageInput({
      messageId: assistant.id,
      messages: [root, assistant],
    });

    expect(result).toMatchObject({
      isPrimaryParallel: false,
      ok: true,
      parallelGroupId: "group-1",
      parallelIndex: 1,
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
    expect(result.ok ? result.selectedModelId : null).toBe("openai/gpt-5-mini");
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
