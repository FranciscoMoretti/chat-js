import assert from "node:assert/strict";
import type { ChatTransport, UIMessageChunk } from "ai";
import { describe, it, vi } from "vitest";
import type { ChatMessage } from "@/lib/ai/types";
import { createAssistantRequestMessageId } from "./assistant-request-id";
import { createCancellationAwareChatTransport } from "./cancellation-aware-chat-transport";
import {
  createGatedChatTransport,
  gateChatRequest,
} from "./gated-chat-transport";
import type { GenerationCancellationTarget } from "./generation-cancellation";

const chatId = "019fc917-29fe-7441-952b-7617c2f25f10";
const userMessageId = "019fc917-387d-7fc4-81c7-a2ad437f0ea1";
const requestId = "019fc917-4bde-7f6e-8824-9f104db0fd12";
const parallelGroupId = "019fc917-5ae8-7e86-8476-b2a4ad878623";

const message: ChatMessage = {
  id: userMessageId,
  metadata: {
    activeStreamId: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    isPrimaryParallel: null,
    parallelGroupId,
    parallelIndex: null,
    parentMessageId: null,
    selectedModel: "openai/gpt-5-mini",
  },
  parts: [{ text: "Compare these", type: "text" }],
  role: "user",
};

function requestOptions({
  abortSignal,
  metadata,
}: {
  abortSignal?: AbortSignal;
  metadata?: unknown;
} = {}): Parameters<ChatTransport<ChatMessage>["sendMessages"]>[0] {
  return {
    abortSignal,
    body: {
      parallelGroupId,
      parallelIndex: 1,
      requestId,
      selectedModelId: "openai/gpt-5-nano",
    },
    chatId,
    messageId: undefined,
    messages: [message],
    metadata,
    trigger: "submit-message",
  };
}

describe("createCancellationAwareChatTransport", () => {
  it("cancels the exact forwarded request identity", async () => {
    const abortController = new AbortController();
    const cancellations: GenerationCancellationTarget[] = [];
    const onCancel = vi.fn((target: GenerationCancellationTarget) => {
      cancellations.push(target);
      return Promise.resolve();
    });
    let forwardedBody: object | undefined;
    const transport = createCancellationAwareChatTransport({
      onCancel,
      transport: {
        reconnectToStream: () => Promise.resolve(null),
        sendMessages: (options) => {
          forwardedBody = options.body;
          return Promise.resolve(new ReadableStream<UIMessageChunk>());
        },
      },
    });

    await transport.sendMessages(
      requestOptions({ abortSignal: abortController.signal })
    );
    abortController.abort();

    await vi.waitFor(() => assert.equal(onCancel.mock.calls.length, 1));
    assert.deepEqual(forwardedBody, {
      parallelGroupId,
      parallelIndex: 1,
      requestId,
      selectedModelId: "openai/gpt-5-nano",
    });
    assert.deepEqual(cancellations[0], {
      chatId,
      messageId: createAssistantRequestMessageId({
        chatId,
        parallelGroupId,
        parallelIndex: 1,
        requestId,
        selectedModelId: "openai/gpt-5-nano",
        userMessageId,
      }),
      type: "request",
    });
  });

  it("does not create a server cancellation for a gated request stopped locally", async () => {
    const abortController = new AbortController();
    const onCancel = vi.fn(() => Promise.resolve());
    const sendMessages = vi.fn(() =>
      Promise.resolve(new ReadableStream<UIMessageChunk>())
    );
    const transport = createGatedChatTransport(
      createCancellationAwareChatTransport({
        onCancel,
        transport: {
          reconnectToStream: () => Promise.resolve(null),
          sendMessages,
        },
      })
    );

    const request = transport.sendMessages(
      requestOptions({
        abortSignal: abortController.signal,
        metadata: gateChatRequest(new Promise<void>(() => undefined)).metadata,
      })
    );
    abortController.abort();

    await assert.rejects(request, { name: "AbortError" });
    assert.equal(sendMessages.mock.calls.length, 0);
    assert.equal(onCancel.mock.calls.length, 0);
  });

  it("does not cancel a request after its stream completes", async () => {
    const abortController = new AbortController();
    const onCancel = vi.fn(() => Promise.resolve());
    const transport = createCancellationAwareChatTransport({
      onCancel,
      transport: {
        reconnectToStream: () => Promise.resolve(null),
        sendMessages: () =>
          Promise.resolve(
            new ReadableStream<UIMessageChunk>({
              start(controller) {
                controller.close();
              },
            })
          ),
      },
    });

    const stream = await transport.sendMessages(
      requestOptions({ abortSignal: abortController.signal })
    );
    await stream.pipeTo(new WritableStream());
    abortController.abort();

    assert.equal(onCancel.mock.calls.length, 0);
  });
});
