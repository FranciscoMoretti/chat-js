import type { ChatTransport, UIMessage, UIMessageChunk } from "ai";

import type { ReadonlyDeep } from "./readonly-types";

const SDK_PARAMETER_INDEX = 0;

// oxlint-disable-next-line unicorn/no-null -- The reconnect stream uses the SDK-required null sentinel for its empty state.
const NO_RECONNECT_STREAM = null;

/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
export class ControlledTransport implements ChatTransport<UIMessage> {
  public readonly requests: {
    abortSignal: AbortSignal | undefined;
    controller: ReadableStreamDefaultController<UIMessageChunk>;
    options: ReadonlyDeep<
      Parameters<
        ChatTransport<UIMessage>["sendMessages"]
      >[typeof SDK_PARAMETER_INDEX]
    >;
  }[] = [];
  #reconnectStream:
    | ReadableStream<UIMessageChunk>
    | typeof NO_RECONNECT_STREAM = NO_RECONNECT_STREAM;

  public sendMessages: ChatTransport<UIMessage>["sendMessages"] = (
    options: ReadonlyDeep<
      Parameters<
        ChatTransport<UIMessage>["sendMessages"]
      >[typeof SDK_PARAMETER_INDEX]
    >
  ): ReturnType<ChatTransport<UIMessage>["sendMessages"]> =>
    Promise.resolve(
      new ReadableStream({
        start: (
          controller: Readonly<ReadableStreamDefaultController<UIMessageChunk>>
        ): void => {
          this.requests.push({
            abortSignal: options.abortSignal,
            controller,
            options,
          });
          options.abortSignal?.addEventListener(
            "abort",
            (): void => {
              controller.enqueue({ type: "abort" });
              controller.close();
            },
            { once: true }
          );
        },
      })
    );

  public reconnectToStream(
    _options: ReadonlyDeep<
      Parameters<
        ChatTransport<UIMessage>["reconnectToStream"]
      >[typeof SDK_PARAMETER_INDEX]
    >
  ): Promise<ReadableStream<UIMessageChunk> | null> {
    const stream = this.#reconnectStream;
    this.#reconnectStream = NO_RECONNECT_STREAM;
    return Promise.resolve(stream);
  }

  public prepareReconnect(): ReadableStreamDefaultController<UIMessageChunk> {
    const holder: {
      controller?: Readonly<ReadableStreamDefaultController<UIMessageChunk>>;
    } = {};
    this.#reconnectStream = new ReadableStream({
      start(
        value: Readonly<ReadableStreamDefaultController<UIMessageChunk>>
      ): void {
        holder.controller = value;
      },
    });
    const { controller } = holder;
    if (!controller) {
      throw new Error("Expected reconnect controller");
    }
    return controller;
  }

  public emit(requestIndex: number, chunk: ReadonlyDeep<UIMessageChunk>): void {
    this.requests[requestIndex]?.controller.enqueue(chunk);
  }

  public finish(requestIndex: number): void {
    this.requests[requestIndex]?.controller.close();
  }

  public fail(requestIndex: number, error: Readonly<Error>): void {
    this.requests[requestIndex]?.controller.error(error);
  }

  public emitText(requestIndex: number, messageId: string, text: string): void {
    const controller = this.requests[requestIndex]?.controller;
    controller?.enqueue({ messageId, type: "start" });
    controller?.enqueue({ id: "text", type: "text-start" });
    controller?.enqueue({ delta: text, id: "text", type: "text-delta" });
    controller?.enqueue({ id: "text", type: "text-end" });
    controller?.close();
  }
}
/* oxlint-enable typescript/promise-function-async */
