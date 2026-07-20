import assert from "node:assert/strict";
import type { ChatTransport, UIMessage, UIMessageChunk } from "ai";
import { describe, it, vi } from "vitest";
import {
  createGatedChatTransport,
  gateChatRequest,
} from "./gated-chat-transport";

function requestOptions(
  metadata: unknown,
  abortSignal?: AbortSignal
): Parameters<ChatTransport<UIMessage>["sendMessages"]>[0] {
  return {
    abortSignal,
    chatId: "chat-1",
    messageId: undefined,
    messages: [],
    metadata,
    trigger: "submit-message",
  };
}

describe("createGatedChatTransport", () => {
  it("waits before forwarding a request and restores its metadata", async () => {
    let release: () => void = () => undefined;
    const ready = new Promise<void>((resolve) => {
      release = resolve;
    });
    const stream = new ReadableStream<UIMessageChunk>();
    let forwardedMetadata: unknown;
    const sendMessages = vi.fn(
      (options: Parameters<ChatTransport<UIMessage>["sendMessages"]>[0]) => {
        forwardedMetadata = options.metadata;
        return Promise.resolve(stream);
      }
    );
    const transport = createGatedChatTransport<UIMessage>({
      reconnectToStream: async () => null,
      sendMessages,
    });
    const originalMetadata = { source: "secondary" };

    const request = transport.sendMessages(
      requestOptions(gateChatRequest(ready, originalMetadata).metadata)
    );

    await Promise.resolve();
    assert.equal(sendMessages.mock.calls.length, 0);

    release();
    assert.equal(await request, stream);
    assert.equal(sendMessages.mock.calls.length, 1);
    assert.equal(forwardedMetadata, originalMetadata);
  });

  it("does not forward a request stopped while waiting", async () => {
    const ready = new Promise<void>(() => undefined);
    const sendMessages = vi.fn(() =>
      Promise.resolve(new ReadableStream<UIMessageChunk>())
    );
    const transport = createGatedChatTransport<UIMessage>({
      reconnectToStream: async () => null,
      sendMessages,
    });
    const abortController = new AbortController();
    const request = transport.sendMessages(
      requestOptions(gateChatRequest(ready).metadata, abortController.signal)
    );

    abortController.abort();

    await assert.rejects(request, { name: "AbortError" });
    assert.equal(sendMessages.mock.calls.length, 0);
  });
});
