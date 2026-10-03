import type { ChatState, ChatStatus, UIMessage } from "ai";

import type { ThreadRunHost, ThreadRunSpec } from "./ai-sdk-run-chat";

const cloneSnapshot = <T>(thing: T): T => structuredClone(thing);

export class ThreadRunState<
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

  public get error() {
    return this.#error;
  }

  public set error(error: Error | undefined) {
    this.#error = error;
    this.#host.setRunError(this.#spec.id, error);
  }

  public get messages() {
    return this.#messages;
  }

  public set messages(messages: TMessage[]) {
    this.#messages = messages;
    this.#host.updateRunPath(messages);
  }

  public get status() {
    return this.#status;
  }

  public set status(status: ChatStatus) {
    this.#status = status;
    this.#host.setRunStatus(this.#spec.id, status);
  }

  public refreshPath() {
    this.#messages = this.#host.getMessagePath(
      this.#spec.messageId ?? this.#spec.initialPathMessageId
    );
  }

  public popMessage = () => {
    const lastMessage = this.#messages.pop();
    if (lastMessage) {
      this.#host.removeMessage(lastMessage.id);
    }
  };

  public pushMessage = (message: TMessage) => {
    const messageWithPrefix = this.withResumePrefix(message);
    this.#messages.push(messageWithPrefix);
    this.writeMessage(messageWithPrefix);
  };

  public replaceMessage = (index: number, message: TMessage) => {
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

  private writeMessage(message: TMessage) {
    this.#host.writeRunMessage(this.#spec.id, message);
  }
}
