import type { ChatTransport, UIMessage, UIMessageChunk } from "ai";

import type { ReadonlyDeep } from "./readonly-types";

/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
const reconnectToNoStream: ChatTransport<UIMessage>["reconnectToStream"] =
  (): Promise<null> =>
    // oxlint-disable-next-line unicorn/no-null -- ChatTransport reconnectToStream requires null when no stream is available.
    Promise.resolve(null);
/* oxlint-enable typescript/promise-function-async */

const SDK_PARAMETER_INDEX = 0;
const LAST_REQUEST_INDEX = -1;

/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
export class ControlledTransport implements ChatTransport<UIMessage> {
  public readonly requests: {
    controller: ReadableStreamDefaultController<UIMessageChunk>;
    options: ReadonlyDeep<
      Parameters<
        ChatTransport<UIMessage>["sendMessages"]
      >[typeof SDK_PARAMETER_INDEX]
    >;
  }[] = [];

  public get request():
    | ReadonlyDeep<
        Parameters<
          ChatTransport<UIMessage>["sendMessages"]
        >[typeof SDK_PARAMETER_INDEX]
      >
    | undefined {
    return this.requests.at(LAST_REQUEST_INDEX)?.options;
  }

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
          this.requests.push({ controller, options });
        },
      })
    );

  public reconnectToStream = reconnectToNoStream;

  public emit(...chunks: readonly ReadonlyDeep<UIMessageChunk>[]): void {
    for (const chunk of chunks) {
      this.requests.at(LAST_REQUEST_INDEX)?.controller.enqueue(chunk);
    }
  }

  public finish(): void {
    this.requests.at(LAST_REQUEST_INDEX)?.controller.close();
  }

  public fail(error: Readonly<Error>): void {
    this.requests.at(LAST_REQUEST_INDEX)?.controller.error(error);
  }
}
/* oxlint-enable typescript/promise-function-async */
