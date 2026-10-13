import type { ChatTransport, UIMessage } from "ai";

const ZERO_COUNT = 0;
const COUNT_INCREMENT = 1;

const rejectSendMessages: ChatTransport<UIMessage>["sendMessages"] =
  async (): ReturnType<ChatTransport<UIMessage>["sendMessages"]> =>
    await Promise.reject(new Error("Unexpected send"));
export class ResumeTransport implements ChatTransport<UIMessage> {
  public reconnects = ZERO_COUNT;

  public sendMessages = rejectSendMessages;

  public async reconnectToStream(): Promise<null> {
    this.reconnects += COUNT_INCREMENT;
    return await Promise.resolve(null);
  }
}
