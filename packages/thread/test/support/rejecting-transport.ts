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
    // oxlint-disable-next-line typescript/promise-function-async -- Count the request synchronously and return the already-rejected transport failure; async throw conflicts with require-await, while an await adds scheduling.
    (): ReturnType<ChatTransport<UIMessage>["sendMessages"]> => {
      this.requests += COUNT_INCREMENT;
      return Promise.reject(new Error("transport failed"));
    };

  public reconnectToStream = reconnectToNoStream;
}
