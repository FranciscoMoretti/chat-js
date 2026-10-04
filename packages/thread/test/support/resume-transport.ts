import type { ChatTransport, UIMessage } from "ai";

const ZERO_COUNT = 0;
const COUNT_INCREMENT = 1;

const rejectSendMessages: ChatTransport<UIMessage>["sendMessages"] =
  // oxlint-disable-next-line typescript/promise-function-async -- Expose the already-rejected unexpected-send failure; async throw conflicts with require-await, while adopting or awaiting the rejection adds scheduling.
  (): ReturnType<ChatTransport<UIMessage>["sendMessages"]> =>
    Promise.reject(new Error("Unexpected send"));

export class ResumeTransport implements ChatTransport<UIMessage> {
  public reconnects = ZERO_COUNT;

  public sendMessages = rejectSendMessages;

  // oxlint-disable-next-line typescript/promise-function-async -- Count the reconnect synchronously and return the fulfilled SDK null sentinel; async literal conflicts with require-await, while an await defers settlement.
  public reconnectToStream(): Promise<null> {
    this.reconnects += COUNT_INCREMENT;
    // oxlint-disable-next-line unicorn/no-null -- ChatTransport reconnectToStream requires null when no stream is available.
    return Promise.resolve(null);
  }
}
