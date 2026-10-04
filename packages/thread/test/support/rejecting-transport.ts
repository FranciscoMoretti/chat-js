import type { ChatTransport, UIMessage } from "ai";

const ZERO_COUNT = 0;
const COUNT_INCREMENT = 1;

/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
const reconnectToNoStream: ChatTransport<UIMessage>["reconnectToStream"] =
  (): Promise<null> =>
    // oxlint-disable-next-line unicorn/no-null -- ChatTransport reconnectToStream requires null when no stream is available.
    Promise.resolve(null);
/* oxlint-enable typescript/promise-function-async */

/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
export class RejectingTransport implements ChatTransport<UIMessage> {
  public requests = ZERO_COUNT;

  public sendMessages: ChatTransport<UIMessage>["sendMessages"] =
    (): ReturnType<ChatTransport<UIMessage>["sendMessages"]> => {
      this.requests += COUNT_INCREMENT;
      return Promise.reject(new Error("transport failed"));
    };

  public reconnectToStream = reconnectToNoStream;
}
/* oxlint-enable typescript/promise-function-async */
