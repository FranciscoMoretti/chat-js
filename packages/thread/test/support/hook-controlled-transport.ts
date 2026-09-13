import type { ChatTransport, UIMessage, UIMessageChunk } from "ai";

const reconnectToNoStream: ChatTransport<UIMessage>["reconnectToStream"] = () =>
  Promise.resolve(null);

export class ControlledTransport implements ChatTransport<UIMessage> {
  readonly requests: ReadableStreamDefaultController<UIMessageChunk>[] = [];

  sendMessages: ChatTransport<UIMessage>["sendMessages"] = () =>
    Promise.resolve(
      new ReadableStream({
        start: (controller) => {
          this.requests.push(controller);
        },
      })
    );

  reconnectToStream = reconnectToNoStream;

  emit(requestIndex: number, chunk: UIMessageChunk) {
    this.requests[requestIndex]?.enqueue(chunk);
  }

  finish(requestIndex: number) {
    this.requests[requestIndex]?.close();
  }
}
