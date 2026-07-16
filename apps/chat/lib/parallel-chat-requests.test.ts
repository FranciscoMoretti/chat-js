import assert from "node:assert/strict";
import { Thread } from "@chatjs/thread";
import type { ChatTransport, UIMessageChunk } from "ai";
import { afterEach, describe, it, vi } from "vitest";
import type { ChatMessage } from "@/lib/ai/types";
import type { ParallelRequestSpec } from "./draft-chat-submission";
import { createGatedChatTransport } from "./gated-chat-transport";
import {
  acknowledgeParallelUserMessagePersistence,
  clearParallelPersistenceGates,
  runParallelThreadRequestSpecs,
} from "./parallel-chat-requests";

class ControlledTransport implements ChatTransport<ChatMessage> {
  readonly requests: Array<{
    body: object | undefined;
    controller: ReadableStreamDefaultController<UIMessageChunk>;
  }> = [];

  reconnectToStream() {
    return Promise.resolve(null);
  }

  sendMessages: ChatTransport<ChatMessage>["sendMessages"] = (options) =>
    Promise.resolve(
      new ReadableStream<UIMessageChunk>({
        start: (controller) => {
          this.requests.push({ body: options.body, controller });
        },
      })
    );

  finish(requestIndex: number, messageId: string) {
    const controller = this.requests[requestIndex]?.controller;
    controller?.enqueue({ messageId, type: "start" });
    controller?.enqueue({ id: "text", type: "text-start" });
    controller?.enqueue({ delta: "done", id: "text", type: "text-delta" });
    controller?.enqueue({ id: "text", type: "text-end" });
    controller?.close();
  }
}

const message: ChatMessage = {
  id: "user-follow-up",
  metadata: {
    activeStreamId: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    isPrimaryParallel: null,
    parallelGroupId: "response-group-1",
    parallelIndex: null,
    parentMessageId: null,
    selectedModel: "openai/gpt-5-mini",
  },
  parts: [{ type: "text", text: "Compare both approaches" }],
  role: "user",
};

const requestSpecs = [
  {
    createdAt: new Date("2026-01-01T00:00:00.001Z"),
    isPrimary: true,
    modelId: "openai/gpt-5-mini",
    parallelGroupId: "response-group-1",
    parallelIndex: 0,
  },
  {
    createdAt: new Date("2026-01-01T00:00:00.002Z"),
    isPrimary: false,
    modelId: "openai/gpt-5-nano",
    parallelGroupId: "response-group-1",
    parallelIndex: 1,
  },
] satisfies ParallelRequestSpec[];

afterEach(() => {
  clearParallelPersistenceGates();
});

describe("runParallelThreadRequestSpecs", () => {
  it("creates every run immediately and gates only secondary transport", async () => {
    const underlyingTransport = new ControlledTransport();
    const chat = new Thread<ChatMessage>({
      transport: createGatedChatTransport(underlyingTransport),
    });

    const result = runParallelThreadRequestSpecs({
      chatId: "chat-1",
      isAuthenticated: true,
      message,
      projectId: "project-1",
      requestSpecs,
      startRun: chat.startRun,
    });

    await vi.waitFor(() => {
      assert.equal(chat.getSnapshot().runs.length, 2);
    });
    assert.equal(underlyingTransport.requests.length, 1);
    assert.deepEqual(chat.getChildren(message.id), []);
    assert.deepEqual(
      chat.getSnapshot().runs.map(({ status }) => status),
      ["submitted", "submitted"]
    );
    assert.equal(
      "assistantMessageId" in (underlyingTransport.requests[0]?.body ?? {}),
      false
    );

    assert.equal(
      acknowledgeParallelUserMessagePersistence({
        chatId: "chat-1",
        parallelGroupId: "response-group-1",
        userMessageId: message.id,
      }),
      true
    );
    await vi.waitFor(() => {
      assert.equal(underlyingTransport.requests.length, 2);
    });

    underlyingTransport.finish(0, "server-primary");
    underlyingTransport.finish(1, "server-secondary");

    assert.deepEqual(await result, []);
    assert.deepEqual(
      chat.getChildren(message.id).map(({ id }) => id),
      ["server-primary", "server-secondary"]
    );
  });
});
