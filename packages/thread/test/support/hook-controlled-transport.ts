import type { ChatTransport, UIMessage, UIMessageChunk } from "ai";

/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */
/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
const reconnectToNoStream: ChatTransport<UIMessage>["reconnectToStream"] = () =>
  Promise.resolve(null);
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable unicorn/no-null */

/* oxlint-disable import/prefer-default-export -- Keep the named import contract used by registry consumers and package callers even when this module exposes one value. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
/* oxlint-disable oxc/no-optional-chaining -- Optional access deliberately propagates absence from the external or partially initialized data contract. */
/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
export class ControlledTransport implements ChatTransport<UIMessage> {
  public readonly requests: ReadableStreamDefaultController<UIMessageChunk>[] =
    [];

  public sendMessages: ChatTransport<UIMessage>["sendMessages"] = () =>
    Promise.resolve(
      new ReadableStream({
        start: (controller): void => {
          this.requests.push(controller);
        },
      })
    );

  public reconnectToStream = reconnectToNoStream;

  public emit(requestIndex: number, chunk: UIMessageChunk): void {
    this.requests[requestIndex]?.enqueue(chunk);
  }

  public finish(requestIndex: number): void {
    this.requests[requestIndex]?.close();
  }
}
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable oxc/no-optional-chaining */
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/prefer-default-export */
