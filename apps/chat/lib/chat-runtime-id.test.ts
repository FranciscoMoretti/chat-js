import { describe, expect, it } from "vitest";

import {
  createChatThreadRuntimeId,
  createMainChatRuntimeId,
  MAIN_CHAT_THREAD_ID,
  parseChatRuntimeId,
} from "./chat-runtime-id";

describe("chat runtime ids", () => {
  it("creates and parses main chat runtime ids", () => {
    const runtimeId = createMainChatRuntimeId("chat-1");

    expect(runtimeId).toBe("chat:chat-1:thread:main");
    expect(parseChatRuntimeId(runtimeId)).toEqual({
      chatId: "chat-1",
      threadId: MAIN_CHAT_THREAD_ID,
    });
  });

  it("creates and parses thread runtime ids with escaped parts", () => {
    const runtimeId = createChatThreadRuntimeId({
      chatId: "chat:1",
      threadId: "thread/2",
    });

    expect(runtimeId).toBe("chat:chat%3A1:thread:thread%2F2");
    expect(parseChatRuntimeId(runtimeId)).toEqual({
      chatId: "chat:1",
      threadId: "thread/2",
    });
  });

  it("rejects invalid runtime ids", () => {
    expect(parseChatRuntimeId(null)).toBeNull();
    expect(parseChatRuntimeId("chat:chat-1")).toBeNull();
    expect(parseChatRuntimeId("chat::thread:main")).toBeNull();
  });
});
