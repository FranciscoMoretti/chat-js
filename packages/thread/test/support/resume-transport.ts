import type { ChatTransport, UIMessage } from "ai";

const rejectSendMessages: ChatTransport<UIMessage>["sendMessages"] = () =>
  Promise.reject(new Error("Unexpected send"));

export class ResumeTransport implements ChatTransport<UIMessage> {
  reconnects = 0;

  sendMessages = rejectSendMessages;

  reconnectToStream() {
    this.reconnects += 1;
    return Promise.resolve(null);
  }
}
