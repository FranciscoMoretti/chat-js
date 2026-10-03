import type { ChatTransport, UIMessage, UIMessageChunk } from "ai";

/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */
/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
const reconnectToNoStream: ChatTransport<UIMessage>["reconnectToStream"] =
  (): Promise<null> => Promise.resolve(null);
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable unicorn/no-null */

/* oxlint-disable eslint/no-magic-numbers -- These values are concrete test inputs and expected results; naming each literal would make the fixture harder to compare with its assertions. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
export class ControlledTransport implements ChatTransport<UIMessage> {
  public readonly requests: {
    controller: ReadableStreamDefaultController<UIMessageChunk>;
    options: Parameters<ChatTransport<UIMessage>["sendMessages"]>[0];
  }[] = [];

  public get request():
    | Parameters<ChatTransport<UIMessage>["sendMessages"]>[0]
    | undefined {
    return this.requests.at(-1)?.options;
  }

  public sendMessages: ChatTransport<UIMessage>["sendMessages"] = (
    options
  ): ReturnType<ChatTransport<UIMessage>["sendMessages"]> =>
    Promise.resolve(
      new ReadableStream({
        start: (controller): void => {
          this.requests.push({ controller, options });
        },
      })
    );

  public reconnectToStream = reconnectToNoStream;

  public emit(...chunks: UIMessageChunk[]): void {
    for (const chunk of chunks) {
      this.requests.at(-1)?.controller.enqueue(chunk);
    }
  }

  public finish(): void {
    this.requests.at(-1)?.controller.close();
  }

  public fail(error: Error): void {
    this.requests.at(-1)?.controller.error(error);
  }
}
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-magic-numbers */
