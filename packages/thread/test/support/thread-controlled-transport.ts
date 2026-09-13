import type { ChatTransport, UIMessage, UIMessageChunk } from "ai";

export class ControlledTransport implements ChatTransport<UIMessage> {
  readonly requests: {
    abortSignal: AbortSignal | undefined;
    controller: ReadableStreamDefaultController<UIMessageChunk>;
    options: Parameters<ChatTransport<UIMessage>["sendMessages"]>[0];
  }[] = [];
  #reconnectStream: ReadableStream<UIMessageChunk> | null = null;

  sendMessages: ChatTransport<UIMessage>["sendMessages"] = (options) =>
    Promise.resolve(
      new ReadableStream({
        start: (controller) => {
          this.requests.push({
            abortSignal: options.abortSignal,
            controller,
            options,
          });
          options.abortSignal?.addEventListener(
            "abort",
            () => {
              controller.enqueue({ type: "abort" });
              controller.close();
            },
            { once: true }
          );
        },
      })
    );

  reconnectToStream(
    _options: Parameters<ChatTransport<UIMessage>["reconnectToStream"]>[0]
  ): Promise<ReadableStream<UIMessageChunk> | null> {
    const stream = this.#reconnectStream;
    this.#reconnectStream = null;
    return Promise.resolve(stream);
  }

  prepareReconnect() {
    let controller: ReadableStreamDefaultController<UIMessageChunk> | undefined;
    this.#reconnectStream = new ReadableStream({
      start(value) {
        controller = value;
      },
    });
    if (!controller) {
      throw new Error("Expected reconnect controller");
    }
    return controller;
  }

  emit(requestIndex: number, chunk: UIMessageChunk) {
    this.requests[requestIndex]?.controller.enqueue(chunk);
  }

  finish(requestIndex: number) {
    this.requests[requestIndex]?.controller.close();
  }

  fail(requestIndex: number, error: Error) {
    this.requests[requestIndex]?.controller.error(error);
  }

  emitText(requestIndex: number, messageId: string, text: string) {
    const controller = this.requests[requestIndex]?.controller;
    controller?.enqueue({ messageId, type: "start" });
    controller?.enqueue({ id: "text", type: "text-start" });
    controller?.enqueue({ delta: text, id: "text", type: "text-delta" });
    controller?.enqueue({ id: "text", type: "text-end" });
    controller?.close();
  }
}
