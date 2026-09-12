import type { ChatTransport, UIMessage } from "ai";

const reconnectToNoStream: ChatTransport<UIMessage>["reconnectToStream"] = () =>
  Promise.resolve(null);

export class RejectingTransport implements ChatTransport<UIMessage> {
  requests = 0;

  sendMessages: ChatTransport<UIMessage>["sendMessages"] = () => {
    this.requests += 1;
    return Promise.reject(new Error("transport failed"));
  };

  reconnectToStream = reconnectToNoStream;
}
