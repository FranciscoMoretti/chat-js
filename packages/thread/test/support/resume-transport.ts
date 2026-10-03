import type { ChatTransport, UIMessage } from "ai";

/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
const rejectSendMessages: ChatTransport<UIMessage>["sendMessages"] =
  (): ReturnType<ChatTransport<UIMessage>["sendMessages"]> =>
    Promise.reject(new Error("Unexpected send"));
/* oxlint-enable typescript/promise-function-async */

/* oxlint-disable eslint/no-magic-numbers -- These values are concrete test inputs and expected results; naming each literal would make the fixture harder to compare with its assertions. */
/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */
/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
export class ResumeTransport implements ChatTransport<UIMessage> {
  public reconnects = 0;

  public sendMessages = rejectSendMessages;

  public reconnectToStream(): Promise<null> {
    this.reconnects += 1;
    return Promise.resolve(null);
  }
}
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable unicorn/no-null */
/* oxlint-enable eslint/no-magic-numbers */
