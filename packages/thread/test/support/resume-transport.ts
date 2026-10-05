import type { ChatTransport, UIMessage } from "ai";

const ZERO_COUNT = 0;
const COUNT_INCREMENT = 1;

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve rejectSendMessages's awaited sequencing and rejected-Promise behavior. */
const rejectSendMessages: ChatTransport<UIMessage>["sendMessages"] =
  async (): ReturnType<ChatTransport<UIMessage>["sendMessages"]> =>
    await Promise.reject(new Error("Unexpected send"));
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (ResumeTransport); the enabled import/no-default-export convention rejects the default-export alternative. */
/* oxlint-enable oxc/no-async-await */
export class ResumeTransport implements ChatTransport<UIMessage> {
  public reconnects = ZERO_COUNT;

  public sendMessages = rejectSendMessages;

  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve reconnectToStream's awaited sequencing and rejected-Promise behavior. */
  public async reconnectToStream(): Promise<null> {
    this.reconnects += COUNT_INCREMENT;
    // oxlint-disable-next-line unicorn/no-null -- ChatTransport reconnectToStream requires null when no stream is available.
    return await Promise.resolve(null);
  }
  /* oxlint-enable oxc/no-async-await */
}
/* oxlint-enable import/prefer-default-export, import/no-named-export */
