import type { ChatState, ChatStatus, UIMessage } from "ai";
import type { ThreadRunHost, ThreadRunSpec } from "./ai-sdk-run-chat";

const CURRENT_RESPONSE_OFFSET = 1;

const NO_RESUME_PREFIX = globalThis.undefined;

type RunStateHost<TMessage extends UIMessage> = Readonly<
  Pick<
    ThreadRunHost<TMessage>,
    | "getMessagePath"
    | "updateRunPath"
    | "removeMessage"
    | "setRunError"
    | "setRunStatus"
    | "writeRunMessage"
  >
>;

const cloneSnapshot = <TValue>(thing: TValue): TValue => structuredClone(thing);

class ThreadRunState<
  TMessage extends UIMessage,
> implements ChatState<TMessage> {
  #error: Error | undefined;
  public resumePrefix: TMessage | undefined;
  public preserveReconnectError = false;
  readonly #host: RunStateHost<TMessage>;
  #messages: TMessage[];
  readonly #spec: Readonly<ThreadRunSpec>;
  #status: ChatStatus = "ready";

  public constructor(
    host: RunStateHost<TMessage>,
    spec: Readonly<ThreadRunSpec>
  ) {
    this.#host = host;
    this.#messages = host.getMessagePath(spec.initialPathMessageId);
    this.#spec = spec;
  }

  public get error(): Error | undefined {
    return this.#error;
  }

  public set error(error: Readonly<Error> | undefined) {
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
    if (index !== this.#messages.length - CURRENT_RESPONSE_OFFSET) {
      throw new Error("A thread run can only replace its current response");
    }
    const messageWithPrefix = this.withResumePrefix(message);
    this.#messages[index] = messageWithPrefix;
    this.writeMessage(messageWithPrefix);
  };

  public snapshot = cloneSnapshot;

  private withResumePrefix(message: TMessage): TMessage {
    const prefix = this.resumePrefix;
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading id from prefix; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
    if (prefix?.id === message.id) {
      // Seed the SDK's response object once, so later tool/approval updates
      // operate on the same restored parts instead of a separate projection.
      message.parts = [...prefix.parts, ...message.parts];
      this.resumePrefix = NO_RESUME_PREFIX;
    }
    return message;
  }

  private writeMessage(message: TMessage): void {
    this.#host.writeRunMessage(this.#spec.id, message);
  }
}

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (ThreadRunState); the enabled import/no-default-export convention rejects the default-export alternative. */
export { ThreadRunState };
/* oxlint-enable import/prefer-default-export, import/no-named-export */
