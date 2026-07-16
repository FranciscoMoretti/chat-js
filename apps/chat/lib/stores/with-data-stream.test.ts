import assert from "node:assert/strict";
import { describe, it } from "vitest";
import type { ChatMessage } from "@/lib/ai/types";
import { createCustomChatStore } from "./custom-store-provider";

describe("withDataStream", () => {
  it("stores transient stream parts on the chat store", () => {
    const store = createCustomChatStore<ChatMessage>();
    const streamPart = {
      type: "data-userMessagePersisted",
      data: {
        chatId: "chat-1",
        parallelGroupId: "group-1",
        userMessageId: "user-1",
      },
    } as const;

    store.getState().setDataStream([streamPart]);
    store.getState().setDataStream((current) => [...current, streamPart]);

    assert.deepEqual(store.getState().dataStream, [streamPart, streamPart]);

    store.getState().reset();

    assert.deepEqual(store.getState().dataStream, []);
  });
});
