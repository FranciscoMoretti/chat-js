import type { ChatTransport, UIMessage, UIMessageChunk } from "ai";

import type { ReadonlyDeep } from "./readonly-types";

/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
const reconnectToNoStream: ChatTransport<UIMessage>["reconnectToStream"] =
  (): Promise<null> =>
    // oxlint-disable-next-line unicorn/no-null -- ChatTransport reconnectToStream requires null when no stream is available.
    Promise.resolve(null);
/* oxlint-enable typescript/promise-function-async */

/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
export class ControlledTransport implements ChatTransport<UIMessage> {
  public readonly requests: ReadableStreamDefaultController<UIMessageChunk>[] =
    [];

  public sendMessages: ChatTransport<UIMessage>["sendMessages"] =
    (): ReturnType<ChatTransport<UIMessage>["sendMessages"]> =>
      Promise.resolve(
        new ReadableStream({
          start: (
            controller: Readonly<
              ReadableStreamDefaultController<UIMessageChunk>
            >
          ): void => {
            this.requests.push(controller);
          },
        })
      );

  public reconnectToStream = reconnectToNoStream;

  public emit(requestIndex: number, chunk: ReadonlyDeep<UIMessageChunk>): void {
    this.requests[requestIndex]?.enqueue(chunk);
  }

  public finish(requestIndex: number): void {
    this.requests[requestIndex]?.close();
  }
}
/* oxlint-enable typescript/promise-function-async */
