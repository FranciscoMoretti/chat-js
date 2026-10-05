import type { ChatTransport, UIMessage } from "ai";

const ZERO_COUNT = 0;
const COUNT_INCREMENT = 1;

const reconnectToNoStream: ChatTransport<UIMessage>["reconnectToStream"] =
  Promise.resolve.bind<typeof Promise, [null], [], Promise<null>>(
    Promise,
    // oxlint-disable-next-line unicorn/no-null -- ChatTransport reconnectToStream requires null when no stream is available.
    null
  );

export class RejectingTransport implements ChatTransport<UIMessage> {
  public requests = ZERO_COUNT;

  public sendMessages: ChatTransport<UIMessage>["sendMessages"] =
    async (): ReturnType<ChatTransport<UIMessage>["sendMessages"]> => {
      this.requests += COUNT_INCREMENT;
      return await Promise.reject(new Error("transport failed"));
    };

  public reconnectToStream = reconnectToNoStream;
}
