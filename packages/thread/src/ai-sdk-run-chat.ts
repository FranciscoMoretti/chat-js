import type {
  ChatInit,
  ChatRequestOptions,
  ChatStatus,
  ChatTransport,
  UIMessage,
  UIMessageChunk,
} from "ai";
import { AbstractChat } from "ai";

import type { ReadonlyMessageValue } from "./message-utils";
import { ThreadRunState } from "./thread-run-state";

const FIRST_PARAMETER_INDEX = 0;
const LAST_MESSAGE_INDEX = -1;

// oxlint-disable-next-line eslint/no-undefined -- Resetting the one-use resume prefix, omitting the response ID, and starting without an input message require the SDK undefined sentinel.
const NO_VALUE = undefined;
// oxlint-disable-next-line unicorn/no-null -- ChatTransport reconnectToStream returns null when the server has no stream; the ready transition preserves an existing run error for that result.
const NO_RECONNECT_STREAM = null;

type RequestReader = Readonly<Omit<ChatRequestOptions, "headers" | "body">> & {
  readonly headers?: Readonly<Record<string, string>> | Readonly<Headers>;
  readonly body?: Readonly<object>;
};

type FinishEventReader<TMessage extends UIMessage> = Readonly<
  Omit<
    Parameters<
      NonNullable<ChatInit<TMessage>["onFinish"]>
    >[typeof FIRST_PARAMETER_INDEX],
    "messages"
  >
> & { readonly messages: readonly TMessage[] };

type ReconnectReader<TMessage extends UIMessage> = RequestReader &
  Readonly<
    Omit<
      Parameters<
        ChatTransport<TMessage>["reconnectToStream"]
      >[typeof FIRST_PARAMETER_INDEX],
      keyof ChatRequestOptions | "abortSignal"
    >
  > & { readonly abortSignal?: Readonly<AbortSignal> };

type RunChatHost<TMessage extends UIMessage> = Readonly<
  Omit<ThreadRunHost<TMessage>, "transport">
> & {
  readonly transport: Readonly<ChatTransport<TMessage>>;
};

interface ThreadRunSpec {
  id: string;
  initialPathMessageId: string | null;
  messageId?: string;
  parentMessageId: string | null;
  siblingOrder: number;
}

interface ThreadRunHost<TMessage extends UIMessage> {
  readonly dataPartSchemas: ChatInit<TMessage>["dataPartSchemas"];
  readonly id: string;
  readonly messageMetadataSchema: ChatInit<TMessage>["messageMetadataSchema"];
  onData: ChatInit<TMessage>["onData"];
  onError: ChatInit<TMessage>["onError"];
  onFinish: ChatInit<TMessage>["onFinish"];
  onToolCall: ChatInit<TMessage>["onToolCall"];
  sendAutomaticallyWhen: ChatInit<TMessage>["sendAutomaticallyWhen"];
  transport: ChatTransport<TMessage>;
  generateMessageId: () => string;
  getMessagePath: (messageId: string | null) => TMessage[];
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Existing run hosts receive mutable SDK message arrays; accepting readonly arrays rejects their contravariant callback implementations.
  updateRunPath: (messages: TMessage[]) => void;
  registerToolCall: (runId: string, toolCallId: string) => void;
  removeMessage: (messageId: string) => void;
  setRunError: (runId: string, error: Readonly<Error> | undefined) => void;
  setRunStatus: (runId: string, status: ChatStatus) => void;
  writeRunMessage: (runId: string, message: TMessage) => void;
}

class ThreadRunChat<TMessage extends UIMessage> extends AbstractChat<TMessage> {
  readonly #state: ThreadRunState<TMessage>;

  public constructor(
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- The SDK receives the original schema instances; recursive readonly JSONSchema arrays are incompatible with FlexibleSchema.
    host: RunChatHost<TMessage>,
    spec: Readonly<ThreadRunSpec>
  ) {
    const responseMessageId = host.generateMessageId();
    const state = new ThreadRunState(host, spec);
    const transport = ThreadRunChat.createTransport(host, spec, state);
    /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve super's awaited sequencing and rejected-Promise behavior. */
    super({
      dataPartSchemas: host.dataPartSchemas,
      generateId: (): string => responseMessageId,
      id: host.id,
      messageMetadataSchema: host.messageMetadataSchema,
      onData: (event): void => host.onData?.(event),
      onError: (error: Readonly<Error>): void => {
        host.onError?.(error);
      },
      onFinish: (event: FinishEventReader<TMessage>): void => {
        host.onFinish?.({
          ...event,
          messages: host.getMessagePath(spec.messageId ?? spec.parentMessageId),
        });
      },
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Preserve the SDK static/dynamic generic tool-call union when forwarding to the current callback; mapped readonly changes its conditional assignability.
      onToolCall: async (event): Promise<void> => {
        host.registerToolCall(spec.id, event.toolCall.toolCallId);
        await host.onToolCall?.(event);
      },
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- The current SDK callback receives the original mutable message array; existing callbacks may update that array.
      sendAutomaticallyWhen: (event): boolean | PromiseLike<boolean> =>
        host.sendAutomaticallyWhen?.(event) ?? false,
      state,
      transport,
    });
    /* oxlint-enable oxc/no-async-await */
    this.#state = state;
  }

  private static createResumeTransform<TMessage extends UIMessage>(
    lastMessage: TMessage | undefined,
    savePrefix: (message: TMessage) => void
  ): TransformStream<UIMessageChunk, UIMessageChunk> {
    let first = true;
    return new TransformStream<UIMessageChunk, UIMessageChunk>({
      transform(
        chunk: ReadonlyMessageValue<UIMessageChunk>,
        controller: Readonly<TransformStreamDefaultController<UIMessageChunk>>
      ): void {
        let chunkToEnqueue = chunk;
        if (
          first &&
          chunk.type === "start" &&
          lastMessage?.role === "assistant"
        ) {
          chunkToEnqueue = {
            ...chunk,
            messageId: chunk.messageId ?? lastMessage.id,
            messageMetadata: chunk.messageMetadata ?? lastMessage.metadata,
          };
        }
        // Full replay starts with `start`. A continuation needs the canonical
        // identity and prefix because SDK 7 initializes empty resume state.
        if (
          first &&
          chunk.type !== "start" &&
          lastMessage?.role === "assistant"
        ) {
          savePrefix(structuredClone(lastMessage));
          controller.enqueue({
            messageId: lastMessage.id,
            messageMetadata: lastMessage.metadata,
            type: "start",
          });
        }
        first = false;
        controller.enqueue(chunkToEnqueue);
      },
    });
  }

  private static createTransport<TMessage extends UIMessage>(
    host: Readonly<Pick<RunChatHost<TMessage>, "transport">>,
    spec: Readonly<ThreadRunSpec>,
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- The transport owns resetting the resume prefix and preserving the reconnect error on this live run state; readonly properties prohibit these required writes.
    state: ThreadRunState<TMessage>
  ): ChatTransport<TMessage> {
    /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve callbacks in this return statement's awaited sequencing and rejected-Promise behavior. */
    return {
      reconnectToStream: async (
        options: ReconnectReader<TMessage>
      ): Promise<ReadableStream<UIMessageChunk> | null> => {
        state.resumePrefix = NO_VALUE;
        const stream = await host.transport.reconnectToStream(options);
        state.preserveReconnectError =
          stream === NO_RECONNECT_STREAM && state.status === "error";
        if (!stream) {
          return NO_RECONNECT_STREAM;
        }
        const lastMessage = state.messages.at(LAST_MESSAGE_INDEX);
        return stream.pipeThrough(
          ThreadRunChat.createResumeTransform(lastMessage, (prefix): void => {
            state.resumePrefix = prefix;
          })
        );
      },
      // oxlint-disable-next-line typescript/promise-function-async -- Custom ChatTransport.sendMessages may throw before returning a promise. Direct forwarding lets SDK makeRequest invoke the public onError callback synchronously during Thread.regenerate; async+await defers that observable callback.
      sendMessages: (
        // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Forward the SDK message array to the current transport without changing its mutable array contract or cloning its identity.
        options
      ): ReturnType<ChatTransport<TMessage>["sendMessages"]> => {
        state.resumePrefix = NO_VALUE;
        return host.transport.sendMessages({
          ...options,
          messageId:
            spec.messageId === NO_VALUE && options.trigger === "submit-message"
              ? NO_VALUE
              : options.messageId,
        });
      },
    };
    /* oxlint-enable oxc/no-async-await */
  }

  protected override setStatus(
    options: Readonly<{
      status: ChatStatus;
      error?: Readonly<Error>;
    }>
  ): void {
    if (this.#state.preserveReconnectError && options.status === "ready") {
      this.#state.preserveReconnectError = false;
      return;
    }
    super.setStatus(options);
  }

  public refreshPath(): void {
    this.#state.refreshPath();
  }

  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve start's awaited sequencing and rejected-Promise behavior. */
  public async start(options?: RequestReader): Promise<void> {
    await this.sendMessage(NO_VALUE, options);
  }
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve startWithMessage's awaited sequencing and rejected-Promise behavior. */
  public async startWithMessage(
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- AbstractChat.sendMessage accepts mutable parts arrays and native FileList input; readonly parts cannot be passed to that SDK method.
    message: NonNullable<
      Parameters<
        AbstractChat<TMessage>["sendMessage"]
      >[typeof FIRST_PARAMETER_INDEX]
    >,
    options?: RequestReader
  ): Promise<void> {
    await this.sendMessage(message, options);
  }
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve regenerateMessage's awaited sequencing and rejected-Promise behavior. */
  public async regenerateMessage(
    messageId: string,
    options?: RequestReader
  ): Promise<void> {
    await this.regenerate({ ...options, messageId });
  }
  /* oxlint-enable oxc/no-async-await */
}

/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (ThreadRunChat); the enabled import/no-default-export convention rejects the default-export alternative. */
export { ThreadRunChat };
/* oxlint-enable import/no-named-export */

/* oxlint-disable import/no-named-export -- Keep the named type bindings (ThreadRunSpec, ThreadRunHost, RequestReader); the enabled import/no-default-export convention rejects the default-export alternative. */
export type { ThreadRunSpec, ThreadRunHost, RequestReader };
/* oxlint-enable import/no-named-export */
