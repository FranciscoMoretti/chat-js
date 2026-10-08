import type { ChatTransport, UIMessage, UIMessageChunk } from "ai";

import type { ReadonlyDeep } from "./readonly-types";

const SDK_PARAMETER_INDEX = 0;

// oxlint-disable-next-line unicorn/no-null -- The reconnect stream uses the SDK-required null sentinel for its empty state.
const NO_RECONNECT_STREAM = null;

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (ControlledTransport); the enabled import/no-default-export convention rejects the default-export alternative. */
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

  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve sendMessages's awaited sequencing and rejected-Promise behavior. */
  public sendMessages: ChatTransport<UIMessage>["sendMessages"] = async (
    options: ReadonlyDeep<
      Parameters<
        ChatTransport<UIMessage>["sendMessages"]
      >[typeof SDK_PARAMETER_INDEX]
    >
  ): ReturnType<ChatTransport<UIMessage>["sendMessages"]> =>
    await Promise.resolve(
      new ReadableStream({
        start: (
          controller: Readonly<ReadableStreamDefaultController<UIMessageChunk>>
        ): void => {
          this.requests.push({
            abortSignal: options.abortSignal,
            controller,
            options,
          });
          const abortSignal = options.abortSignal ?? globalThis.undefined;
          if (abortSignal !== globalThis.undefined) {
            abortSignal.addEventListener(
              "abort",
              (): void => {
                controller.enqueue({ type: "abort" });
                controller.close();
              },
              { once: true }
            );
          }
        },
      })
    );
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve reconnectToStream's awaited sequencing and rejected-Promise behavior. */
  public async reconnectToStream(
    _options: ReadonlyDeep<
      Parameters<
        ChatTransport<UIMessage>["reconnectToStream"]
      >[typeof SDK_PARAMETER_INDEX]
    >
  ): Promise<ReadableStream<UIMessageChunk> | null> {
    const stream = this.#reconnectStream;
    this.#reconnectStream = NO_RECONNECT_STREAM;
    return await Promise.resolve(stream);
  }
  /* oxlint-enable oxc/no-async-await */
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
    const request = this.requests[requestIndex] ?? globalThis.undefined;
    if (request === globalThis.undefined) {
      return;
    }
    request.controller.enqueue(chunk);
  }

  public finish(requestIndex: number): void {
    const request = this.requests[requestIndex] ?? globalThis.undefined;
    if (request === globalThis.undefined) {
      return;
    }
    request.controller.close();
  }

  public fail(requestIndex: number, error: Readonly<Error>): void {
    const request = this.requests[requestIndex] ?? globalThis.undefined;
    if (request === globalThis.undefined) {
      return;
    }
    request.controller.error(error);
  }

  public emitText(requestIndex: number, messageId: string, text: string): void {
    const request = this.requests[requestIndex] ?? globalThis.undefined;
    if (request !== globalThis.undefined) {
      const controller = request.controller ?? globalThis.undefined;
      if (controller !== globalThis.undefined) {
        controller.enqueue({ messageId, type: "start" });
        controller.enqueue({ id: "text", type: "text-start" });
        controller.enqueue({ delta: text, id: "text", type: "text-delta" });
        controller.enqueue({ id: "text", type: "text-end" });
        controller.close();
      }
    }
  }
}
/* oxlint-enable import/prefer-default-export, import/no-named-export */
