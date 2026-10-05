import type { ChatTransport, UIMessage, UIMessageChunk } from "ai";

import type { ReadonlyDeep } from "./readonly-types";

const reconnectToNoStream: ChatTransport<UIMessage>["reconnectToStream"] =
  Promise.resolve.bind<typeof Promise, [null], [], Promise<null>>(
    Promise,
    // oxlint-disable-next-line unicorn/no-null -- ChatTransport reconnectToStream requires null when no stream is available.
    null
  );

export class ControlledTransport implements ChatTransport<UIMessage> {
  public readonly requests: ReadableStreamDefaultController<UIMessageChunk>[] =
    [];

  public sendMessages: ChatTransport<UIMessage>["sendMessages"] =
    async (): ReturnType<ChatTransport<UIMessage>["sendMessages"]> =>
      await Promise.resolve(
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
