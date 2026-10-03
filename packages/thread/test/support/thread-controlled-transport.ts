import type { ChatTransport, UIMessage, UIMessageChunk } from "ai";

/* oxlint-disable import/prefer-default-export -- Keep the named import contract used by registry consumers and package callers even when this module exposes one value. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
/* oxlint-disable typescript/explicit-module-boundary-types -- This exported adapter derives its result from the schema or SDK contract; duplicating that type would erase inference or drift from the source. */
/* oxlint-disable eslint/no-magic-numbers -- These values are concrete test inputs and expected results; naming each literal would make the fixture harder to compare with its assertions. */
/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */
/* oxlint-disable oxc/no-optional-chaining -- Optional access deliberately propagates absence from the external or partially initialized data contract. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable eslint/init-declarations -- The value is assigned by the following guarded operation; an invented initial value would hide an uninitialized control-flow branch. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
export class ControlledTransport implements ChatTransport<UIMessage> {
  public readonly requests: {
    abortSignal: AbortSignal | undefined;
    controller: ReadableStreamDefaultController<UIMessageChunk>;
    options: Parameters<ChatTransport<UIMessage>["sendMessages"]>[0];
  }[] = [];
  #reconnectStream: ReadableStream<UIMessageChunk> | null = null;

  public sendMessages: ChatTransport<UIMessage>["sendMessages"] = (options) =>
    Promise.resolve(
      new ReadableStream({
        start: (controller): void => {
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
    _options: Parameters<ChatTransport<UIMessage>["reconnectToStream"]>[0]
  ): Promise<ReadableStream<UIMessageChunk> | null> {
    const stream = this.#reconnectStream;
    this.#reconnectStream = null;
    return Promise.resolve(stream);
  }

  public prepareReconnect() {
    let controller: ReadableStreamDefaultController<UIMessageChunk> | undefined;
    this.#reconnectStream = new ReadableStream({
      start(value): void {
        controller = value;
      },
    });
    if (!controller) {
      throw new Error("Expected reconnect controller");
    }
    return controller;
  }

  public emit(requestIndex: number, chunk: UIMessageChunk): void {
    this.requests[requestIndex]?.controller.enqueue(chunk);
  }

  public finish(requestIndex: number): void {
    this.requests[requestIndex]?.controller.close();
  }

  public fail(requestIndex: number, error: Error): void {
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/init-declarations */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable oxc/no-optional-chaining */
/* oxlint-enable unicorn/no-null */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable typescript/explicit-module-boundary-types */
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/prefer-default-export */
