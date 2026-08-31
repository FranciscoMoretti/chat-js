import type { ChatTransport } from "ai";
import { z } from "zod";
import type { ChatMessage } from "@/lib/ai/types";
import { getPrimarySelectedModelId } from "@/lib/ai/types";
import { createAssistantRequestMessageId } from "@/lib/assistant-request-id";
import type { GenerationCancellationTarget } from "@/lib/generation-cancellation";
import { generateUUID } from "@/lib/utils";

const requestBodySchema = z
  .object({
    parallelGroupId: z.string().uuid().nullable().optional(),
    parallelIndex: z.number().int().nullable().optional(),
    requestId: z.string().uuid().optional(),
    selectedModelId: z.string().optional(),
  })
  .loose();

interface PreparedRequest {
  options: Parameters<ChatTransport<ChatMessage>["sendMessages"]>[0];
  target: GenerationCancellationTarget;
}

function prepareRequest(
  options: Parameters<ChatTransport<ChatMessage>["sendMessages"]>[0]
): PreparedRequest | null {
  const message = options.messages.at(-1);
  if (message?.role !== "user") {
    return null;
  }

  const parsedBody = requestBodySchema.safeParse(options.body);
  const body = parsedBody.success ? parsedBody.data : {};
  const selectedModelId =
    body.selectedModelId ??
    getPrimarySelectedModelId(message.metadata.selectedModel);

  if (!selectedModelId) {
    return null;
  }

  const requestId = body.requestId ?? generateUUID();
  const messageId = createAssistantRequestMessageId({
    chatId: options.chatId,
    parallelGroupId:
      body.parallelGroupId ?? message.metadata.parallelGroupId ?? null,
    parallelIndex: body.parallelIndex ?? null,
    requestId,
    selectedModelId,
    userMessageId: message.id,
  });

  return {
    options: {
      ...options,
      body: { ...options.body, requestId },
    },
    target: { chatId: options.chatId, messageId, type: "request" },
  };
}

function cleanupStream<T>(
  stream: ReadableStream<T>,
  cleanup: () => void
): ReadableStream<T> {
  const reader = stream.getReader();

  return new ReadableStream({
    async cancel(reason) {
      cleanup();
      await reader.cancel(reason);
    },
    async pull(controller) {
      try {
        const result = await reader.read();
        if (result.done) {
          cleanup();
          controller.close();
          return;
        }
        controller.enqueue(result.value);
      } catch (error) {
        cleanup();
        controller.error(error);
      }
    },
  });
}

function observeCancellation({
  onCancel,
  signal,
  target,
}: {
  onCancel: (target: GenerationCancellationTarget) => Promise<unknown>;
  signal: AbortSignal | undefined;
  target: GenerationCancellationTarget;
}) {
  if (!signal || signal.aborted) {
    return () => undefined;
  }

  const cancel = () => {
    onCancel(target).catch(() => undefined);
  };
  signal.addEventListener("abort", cancel, { once: true });

  return () => signal.removeEventListener("abort", cancel);
}

export function createCancellationAwareChatTransport({
  onCancel,
  transport,
}: {
  onCancel: (target: GenerationCancellationTarget) => Promise<unknown>;
  transport: ChatTransport<ChatMessage>;
}): ChatTransport<ChatMessage> {
  return {
    reconnectToStream: (options) => transport.reconnectToStream(options),
    async sendMessages(options) {
      const request = prepareRequest(options);
      if (!request) {
        return transport.sendMessages(options);
      }

      const cleanup = observeCancellation({
        onCancel,
        signal: request.options.abortSignal,
        target: request.target,
      });

      try {
        const stream = await transport.sendMessages(request.options);
        return cleanupStream(stream, cleanup);
      } catch (error) {
        cleanup();
        throw error;
      }
    },
  };
}
