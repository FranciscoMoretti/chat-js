import type { ChatTransport, UIMessage } from "ai";

const rejectSendMessages: ChatTransport<UIMessage>["sendMessages"] = () =>
  Promise.reject(new Error("Unexpected send"));

export class ResumeTransport implements ChatTransport<UIMessage> {
  public reconnects = 0;

  public sendMessages = rejectSendMessages;

  public reconnectToStream() {
    this.reconnects += 1;
    return Promise.resolve(null);
  }
}
