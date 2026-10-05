import type { ChatTransport, UIMessage, UIMessageChunk } from "ai";

import type { ReadonlyDeep } from "./readonly-types";

const reconnectToNoStream: ChatTransport<UIMessage>["reconnectToStream"] =
  Promise.resolve.bind<typeof Promise, [null], [], Promise<null>>(
    Promise,
    // oxlint-disable-next-line unicorn/no-null -- ChatTransport reconnectToStream requires null when no stream is available.
    null
  );

const SDK_PARAMETER_INDEX = 0;
const LAST_REQUEST_INDEX = -1;

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (ControlledTransport); the enabled import/no-default-export convention rejects the default-export alternative. */
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
          this.requests.push({ controller, options });
        },
      })
    );
  /* oxlint-enable oxc/no-async-await */
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
/* oxlint-enable import/prefer-default-export, import/no-named-export */
