import type { ChatTransport, UIMessage, UIMessageChunk } from "ai";

const reconnectToNoStream: ChatTransport<UIMessage>["reconnectToStream"] = () =>
  Promise.resolve(null);

export class ControlledTransport implements ChatTransport<UIMessage> {
  readonly requests: {
    controller: ReadableStreamDefaultController<UIMessageChunk>;
    options: Parameters<ChatTransport<UIMessage>["sendMessages"]>[0];
  }[] = [];

  get request() {
    return this.requests.at(-1)?.options;
  }

  sendMessages: ChatTransport<UIMessage>["sendMessages"] = (options) =>
    Promise.resolve(
      new ReadableStream({
        start: (controller) => {
          this.requests.push({ controller, options });
        },
      })
    );

  reconnectToStream = reconnectToNoStream;

  emit(...chunks: UIMessageChunk[]) {
    for (const chunk of chunks) {
      this.requests.at(-1)?.controller.enqueue(chunk);
    }
  }

  finish() {
    this.requests.at(-1)?.controller.close();
  }

  fail(error: Error) {
    this.requests.at(-1)?.controller.error(error);
  }
}
