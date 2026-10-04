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
    // oxlint-disable-next-line unicorn/no-null -- ChatTransport reconnectToStream requires null when no stream is available.
    return await Promise.resolve(null);
  }
}
