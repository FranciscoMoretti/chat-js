import type { ChatTransport, UIMessage, UIMessageChunk } from "ai";

import type { ReadonlyDeep } from "./readonly-types";

const reconnectToNoStream: ChatTransport<UIMessage>["reconnectToStream"] =
  Promise.resolve.bind<typeof Promise, [null], [], Promise<null>>(
    Promise,
    // oxlint-disable-next-line unicorn/no-null -- ChatTransport reconnectToStream requires null when no stream is available.
    null
  );

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (ControlledTransport); the enabled import/no-default-export convention rejects the default-export alternative. */
export class ControlledTransport implements ChatTransport<UIMessage> {
  public readonly requests: ReadableStreamDefaultController<UIMessageChunk>[] =
    [];

  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve sendMessages's awaited sequencing and rejected-Promise behavior. */
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
  /* oxlint-enable oxc/no-async-await */
  public reconnectToStream = reconnectToNoStream;

  public emit(requestIndex: number, chunk: ReadonlyDeep<UIMessageChunk>): void {
    this.requests[requestIndex]?.enqueue(chunk);
  }

  public finish(requestIndex: number): void {
    this.requests[requestIndex]?.close();
  }
}
/* oxlint-enable import/prefer-default-export, import/no-named-export */
