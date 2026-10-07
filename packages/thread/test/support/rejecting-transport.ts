import type { ChatTransport, UIMessage } from "ai";

const ZERO_COUNT = 0;
const COUNT_INCREMENT = 1;

const reconnectToNoStream: ChatTransport<UIMessage>["reconnectToStream"] =
  Promise.resolve.bind<typeof Promise, [null], [], Promise<null>>(
    Promise,
    // oxlint-disable-next-line unicorn/no-null -- ChatTransport reconnectToStream requires null when no stream is available.
    null
  );

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (RejectingTransport); the enabled import/no-default-export convention rejects the default-export alternative. */
export class RejectingTransport implements ChatTransport<UIMessage> {
  public requests = ZERO_COUNT;

  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve sendMessages's awaited sequencing and rejected-Promise behavior. */
  public sendMessages: ChatTransport<UIMessage>["sendMessages"] =
    async (): ReturnType<ChatTransport<UIMessage>["sendMessages"]> => {
      this.requests += COUNT_INCREMENT;
      return await Promise.reject(new Error("transport failed"));
    };
  /* oxlint-enable oxc/no-async-await */
  public reconnectToStream = reconnectToNoStream;
}
/* oxlint-enable import/prefer-default-export, import/no-named-export */
