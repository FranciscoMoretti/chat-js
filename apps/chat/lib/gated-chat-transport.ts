import type { ChatRequestOptions, ChatTransport, UIMessage } from "ai";

type GateEntry = {
  metadata: unknown;
  ready: Promise<void>;
};

const gateEntries = new WeakMap<object, GateEntry>();

const createAbortError = () => new DOMException("Aborted", "AbortError");

const waitForGate = (ready: Promise<void>, signal?: AbortSignal) => {
  if (!signal) {
    return ready;
  }
  if (signal.aborted) {
    void (async () => {
      try {
        await ready;
      } catch {
        // Observe a rejected gate after cancellation without changing the abort error.
      }
    })();
    return Promise.reject(createAbortError());
  }

  return new Promise<void>((resolve, reject) => {
    const abort = () => reject(createAbortError());
    const cleanup = () => signal.removeEventListener("abort", abort);
    signal.addEventListener("abort", abort, { once: true });
    const resolveWhenReady = async () => {
      try {
        await ready;
        cleanup();
        resolve();
      } catch (error) {
        cleanup();
        reject(error);
      }
    };
    void resolveWhenReady();
  });
};

export const gateChatRequest = (
  ready: Promise<void>,
  metadata?: unknown
): Pick<ChatRequestOptions, "metadata"> => {
  const token = {};
  gateEntries.set(token, { metadata, ready });
  return { metadata: token };
};

export const createGatedChatTransport = <TMessage extends UIMessage>(
  transport: ChatTransport<TMessage>
): ChatTransport<TMessage> => ({
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
});
