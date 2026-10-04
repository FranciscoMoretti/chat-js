import type { ChatTransport, UIMessage } from "ai";

const ZERO_COUNT = 0;
const COUNT_INCREMENT = 1;

/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
const rejectSendMessages: ChatTransport<UIMessage>["sendMessages"] =
  (): ReturnType<ChatTransport<UIMessage>["sendMessages"]> =>
    Promise.reject(new Error("Unexpected send"));
/* oxlint-enable typescript/promise-function-async */

/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
export class ResumeTransport implements ChatTransport<UIMessage> {
  public reconnects = ZERO_COUNT;

  public sendMessages = rejectSendMessages;

  public reconnectToStream(): Promise<null> {
    this.reconnects += COUNT_INCREMENT;
    // oxlint-disable-next-line unicorn/no-null -- ChatTransport reconnectToStream requires null when no stream is available.
    return Promise.resolve(null);
  }
}
/* oxlint-enable typescript/promise-function-async */
