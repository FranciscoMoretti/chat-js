import type { ChatTransport, UIMessage, UIMessageChunk } from "ai";

const reconnectToNoStream: ChatTransport<UIMessage>["reconnectToStream"] = () =>
  Promise.resolve(null);

export class ControlledTransport implements ChatTransport<UIMessage> {
  public readonly requests: {
    controller: ReadableStreamDefaultController<UIMessageChunk>;
    options: Parameters<ChatTransport<UIMessage>["sendMessages"]>[0];
  }[] = [];

  public get request() {
    return this.requests.at(-1)?.options;
  }

  public sendMessages: ChatTransport<UIMessage>["sendMessages"] = (options) =>
    Promise.resolve(
      new ReadableStream({
        start: (controller) => {
          this.requests.push({ controller, options });
        },
      })
    );

  public reconnectToStream = reconnectToNoStream;

  public emit(...chunks: UIMessageChunk[]) {
    for (const chunk of chunks) {
      this.requests.at(-1)?.controller.enqueue(chunk);
    }
  }

  public finish() {
    this.requests.at(-1)?.controller.close();
  }

  public fail(error: Error) {
    this.requests.at(-1)?.controller.error(error);
  }
}
