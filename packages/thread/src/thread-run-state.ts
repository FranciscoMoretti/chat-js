import type { ChatState, ChatStatus, UIMessage } from "ai";

import type { ThreadRunHost, ThreadRunSpec } from "./ai-sdk-run-chat";

const cloneSnapshot = <TValue>(thing: TValue): TValue => structuredClone(thing);

/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/* oxlint-disable eslint/no-undefined -- Undefined represents an omitted optional argument or absent value in the existing TypeScript/SDK contract. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- ChatState requires mutable TMessage[] messages; push/replace operations and resume-prefix merging write message.parts before publishing to the run host. */
class ThreadRunState<
  TMessage extends UIMessage,
> implements ChatState<TMessage> {
  #error: Error | undefined;
  public resumePrefix: TMessage | undefined;
  public preserveReconnectError = false;
  readonly #host: ThreadRunHost<TMessage>;
  #messages: TMessage[];
  readonly #spec: ThreadRunSpec;
  #status: ChatStatus = "ready";

  public constructor(host: ThreadRunHost<TMessage>, spec: ThreadRunSpec) {
    this.#host = host;
    this.#messages = host.getMessagePath(spec.initialPathMessageId);
    this.#spec = spec;
  }

  public get error(): Error | undefined {
    return this.#error;
  }

  public set error(error: Error | undefined) {
    this.#error = error;
    this.#host.setRunError(this.#spec.id, error);
  }

  public get messages(): TMessage[] {
    return this.#messages;
  }

  public set messages(messages: TMessage[]) {
    this.#messages = messages;
    this.#host.updateRunPath(messages);
  }

  public get status(): ChatStatus {
    return this.#status;
  }

  public set status(status: ChatStatus) {
    this.#status = status;
    this.#host.setRunStatus(this.#spec.id, status);
  }

  public refreshPath(): void {
    this.#messages = this.#host.getMessagePath(
      this.#spec.messageId ?? this.#spec.initialPathMessageId
    );
  }

  public popMessage = (): void => {
    const lastMessage = this.#messages.pop();
    if (lastMessage) {
      this.#host.removeMessage(lastMessage.id);
    }
  };

  public pushMessage = (message: TMessage): void => {
    const messageWithPrefix = this.withResumePrefix(message);
    this.#messages.push(messageWithPrefix);
    this.writeMessage(messageWithPrefix);
  };

  public replaceMessage = (index: number, message: TMessage): void => {
    if (index !== this.#messages.length - 1) {
      throw new Error("A thread run can only replace its current response");
    }
    const messageWithPrefix = this.withResumePrefix(message);
    this.#messages[index] = messageWithPrefix;
    this.writeMessage(messageWithPrefix);
  };

  public snapshot = cloneSnapshot;

  private withResumePrefix(message: TMessage): TMessage {
    const prefix = this.resumePrefix;
    if (prefix?.id === message.id) {
      // Seed the SDK's response object once, so later tool/approval updates
      // operate on the same restored parts instead of a separate projection.
      message.parts = [...prefix.parts, ...message.parts];
      this.resumePrefix = undefined;
    }
    return message;
  }

  private writeMessage(message: TMessage): void {
    this.#host.writeRunMessage(this.#spec.id, message);
  }
}
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-undefined */
/* oxlint-enable eslint/no-magic-numbers */

export { ThreadRunState };
