import type { ChatTransport, UIMessage } from "ai";

/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */
/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
const reconnectToNoStream: ChatTransport<UIMessage>["reconnectToStream"] =
  (): Promise<null> => Promise.resolve(null);
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable unicorn/no-null */

/* oxlint-disable eslint/no-magic-numbers -- These values are concrete test inputs and expected results; naming each literal would make the fixture harder to compare with its assertions. */
/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
export class RejectingTransport implements ChatTransport<UIMessage> {
  public requests = 0;

  public sendMessages: ChatTransport<UIMessage>["sendMessages"] =
    (): ReturnType<ChatTransport<UIMessage>["sendMessages"]> => {
      this.requests += 1;
      return Promise.reject(new Error("transport failed"));
    };

  public reconnectToStream = reconnectToNoStream;
}
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable eslint/no-magic-numbers */
