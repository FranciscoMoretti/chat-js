import type { ChatRequestOptions, ChatTransport, UIMessage } from "ai";

type GateEntry = {
  metadata: unknown;
  ready: Promise<void>;
};

const gateEntries = new WeakMap<object, GateEntry>();

function createAbortError() {
  return new DOMException("Aborted", "AbortError");
}

function waitForGate(ready: Promise<void>, signal?: AbortSignal) {
  if (!signal) {
    return ready;
  }
  if (signal.aborted) {
    ready.catch(() => undefined);
    return Promise.reject(createAbortError());
  }

  return new Promise<void>((resolve, reject) => {
    const abort = () => reject(createAbortError());
    const cleanup = () => signal.removeEventListener("abort", abort);
    signal.addEventListener("abort", abort, { once: true });
    ready.then(
      () => {
        cleanup();
        resolve();
      },
      (error: unknown) => {
        cleanup();
        reject(error);
      }
    );
  });
}

export function gateChatRequest(
  ready: Promise<void>,
  metadata?: unknown
): Pick<ChatRequestOptions, "metadata"> {
  const token = {};
  gateEntries.set(token, { metadata, ready });
  return { metadata: token };
}

export function createGatedChatTransport<TMessage extends UIMessage>(
  transport: ChatTransport<TMessage>
): ChatTransport<TMessage> {
  return {
    reconnectToStream: (options) => transport.reconnectToStream(options),
    sendMessages: async (options) => {
      const gate =
        typeof options.metadata === "object" && options.metadata !== null
          ? gateEntries.get(options.metadata)
          : undefined;
      if (!gate) {
        return transport.sendMessages(options);
      }

      await waitForGate(gate.ready, options.abortSignal);
      if (options.abortSignal?.aborted) {
        throw createAbortError();
      }
      return transport.sendMessages({
        ...options,
        metadata: gate.metadata,
      });
    },
  };
}
