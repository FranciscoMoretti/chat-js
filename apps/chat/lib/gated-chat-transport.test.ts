import assert from "node:assert/strict";

import type { ChatTransport, UIMessage, UIMessageChunk } from "ai";
import { describe, it, vi } from "vitest";

import {
  createGatedChatTransport,
  gateChatRequest,
} from "./gated-chat-transport";

const requestOptions = (
  metadata: unknown,
  abortSignal?: AbortSignal
): Parameters<ChatTransport<UIMessage>["sendMessages"]>[0] => ({
  abortSignal,
  chatId: "chat-1",
  messageId: undefined,
  messages: [],
  metadata,
  trigger: "submit-message",
});

describe("createGatedChatTransport", () => {
  it("waits before forwarding a request and restores its metadata", async () => {
    const { promise: ready, resolve: release } =
      Promise.withResolvers<undefined>();
    const stream = new ReadableStream<UIMessageChunk>();
    let forwardedMetadata: unknown;
    const sendMessages = vi.fn(
      (options: Parameters<ChatTransport<UIMessage>["sendMessages"]>[0]) => {
        forwardedMetadata = options.metadata;
        return Promise.resolve(stream);
      }
    );
    const transport = createGatedChatTransport<UIMessage>({
      reconnectToStream: () => Promise.resolve(null),
      sendMessages,
    });
    const originalMetadata = { source: "secondary" };

    const request = transport.sendMessages(
      requestOptions(gateChatRequest(ready, originalMetadata).metadata)
    );

    await Promise.resolve();
    assert.equal(sendMessages.mock.calls.length, 0);

    const resolved = undefined;
    release(resolved);
    assert.equal(await request, stream);
    assert.equal(sendMessages.mock.calls.length, 1);
    assert.equal(forwardedMetadata, originalMetadata);
  });

  it("does not forward a request stopped while waiting", async () => {
    const ready = new Promise<void>(() => {});
    const sendMessages = vi.fn(() =>
      Promise.resolve(new ReadableStream<UIMessageChunk>())
    );
    const transport = createGatedChatTransport<UIMessage>({
      reconnectToStream: () => Promise.resolve(null),
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

  it("does not forward a request when its gate rejects", async () => {
    const gateError = new Error("User message was not persisted");
    const sendMessages = vi.fn(() =>
      Promise.resolve(new ReadableStream<UIMessageChunk>())
    );
    const transport = createGatedChatTransport<UIMessage>({
      reconnectToStream: () => Promise.resolve(null),
      sendMessages,
    });
    const abortController = new AbortController();
    const removeEventListener = vi.spyOn(
      abortController.signal,
      "removeEventListener"
    );

    const request = transport.sendMessages(
      requestOptions(
        gateChatRequest(Promise.reject(gateError)).metadata,
        abortController.signal
      )
    );

    await assert.rejects(request, gateError);
    assert.equal(sendMessages.mock.calls.length, 0);
    assert.equal(
      removeEventListener.mock.calls.filter(([type]) => type === "abort")
        .length,
      1
    );
  });

  it("does not forward a request that was already stopped", async () => {
    const abortController = new AbortController();
    abortController.abort();
    const sendMessages = vi.fn(() =>
      Promise.resolve(new ReadableStream<UIMessageChunk>())
    );
    const transport = createGatedChatTransport<UIMessage>({
      reconnectToStream: () => Promise.resolve(null),
      sendMessages,
    });

    const request = transport.sendMessages(
      requestOptions(
        gateChatRequest(Promise.resolve()).metadata,
        abortController.signal
      )
    );

    await assert.rejects(request, { name: "AbortError" });
    assert.equal(sendMessages.mock.calls.length, 0);
  });

  it("observes a gate rejection after a request is stopped while waiting", async () => {
    const { promise: ready, reject: rejectGate } =
      Promise.withResolvers<undefined>();
    const sendMessages = vi.fn(() =>
      Promise.resolve(new ReadableStream<UIMessageChunk>())
    );
    const transport = createGatedChatTransport<UIMessage>({
      reconnectToStream: () => Promise.resolve(null),
      sendMessages,
    });
    const abortController = new AbortController();
    const request = transport.sendMessages(
      requestOptions(gateChatRequest(ready).metadata, abortController.signal)
    );

    abortController.abort();
    await assert.rejects(request, { name: "AbortError" });

    rejectGate(new Error("persist failed after cancellation"));
    await Promise.resolve();

    assert.equal(sendMessages.mock.calls.length, 0);
  });

  it("observes a rejected gate for a request that was already stopped", async () => {
    const { promise: ready, reject: rejectGate } =
      Promise.withResolvers<undefined>();
    const sendMessages = vi.fn(() =>
      Promise.resolve(new ReadableStream<UIMessageChunk>())
    );
    const transport = createGatedChatTransport<UIMessage>({
      reconnectToStream: () => Promise.resolve(null),
      sendMessages,
    });
    const abortController = new AbortController();
    abortController.abort();

    const request = transport.sendMessages(
      requestOptions(gateChatRequest(ready).metadata, abortController.signal)
    );
    await assert.rejects(request, { name: "AbortError" });

    rejectGate(new Error("persist failed before request started"));
    await Promise.resolve();

    assert.equal(sendMessages.mock.calls.length, 0);
  });
});
