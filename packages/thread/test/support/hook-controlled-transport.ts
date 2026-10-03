import type { ChatTransport, UIMessage, UIMessageChunk } from "ai";

const reconnectToNoStream: ChatTransport<UIMessage>["reconnectToStream"] = () =>
  Promise.resolve(null);

export class ControlledTransport implements ChatTransport<UIMessage> {
  public readonly requests: ReadableStreamDefaultController<UIMessageChunk>[] =
    [];

  public sendMessages: ChatTransport<UIMessage>["sendMessages"] = () =>
    Promise.resolve(
      new ReadableStream({
        start: (controller) => {
          this.requests.push(controller);
        },
      })
    );

  public reconnectToStream = reconnectToNoStream;

  public emit(requestIndex: number, chunk: UIMessageChunk) {
    this.requests[requestIndex]?.enqueue(chunk);
  }

  public finish(requestIndex: number) {
    this.requests[requestIndex]?.close();
  }
}
