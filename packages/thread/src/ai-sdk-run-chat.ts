import type {
  ChatInit,
  ChatRequestOptions,
  ChatStatus,
  ChatTransport,
  UIMessage,
  UIMessageChunk,
} from "ai";
import { AbstractChat } from "ai";

import { ThreadRunState } from "./thread-run-state";

const FIRST_PARAMETER_INDEX = 0;
const LAST_MESSAGE_INDEX = -1;

// Resetting the one-use resume prefix, omitting the response ID, and starting without an input message require the SDK undefined sentinel.
const NO_VALUE = globalThis.undefined;
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
    host: RunChatHost<TMessage>,
    spec: Readonly<ThreadRunSpec>
  ) {
    const responseMessageId = host.generateMessageId();
    const state = new ThreadRunState(host, spec);
    const transport = ThreadRunChat.createTransport(host, spec, state);
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
      onToolCall: async (event): Promise<void> => {
        host.registerToolCall(spec.id, event.toolCall.toolCallId);
        await host.onToolCall?.(event);
      },
      sendAutomaticallyWhen: (event): boolean | PromiseLike<boolean> =>
        host.sendAutomaticallyWhen?.(event) ?? false,
      state,
      transport,
    });
    this.#state = state;
  }

  private static createResumeTransform<TMessage extends UIMessage>(
    lastMessage: TMessage | undefined,
    savePrefix: (message: TMessage) => void
  ): TransformStream<UIMessageChunk, UIMessageChunk> {
    let first = true;
    return new TransformStream<UIMessageChunk, UIMessageChunk>({
      transform(
        chunk: Readonly<UIMessageChunk>,
        controller: Readonly<TransformStreamDefaultController<UIMessageChunk>>
      ): void {
        let chunkToEnqueue = chunk;
        if (
          first &&
          chunk.type === "start" &&
          lastMessage &&
          lastMessage.role === "assistant"
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
          lastMessage &&
          lastMessage.role === "assistant"
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
    state: ThreadRunState<TMessage>
  ): ChatTransport<TMessage> {
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
      sendMessages: async (
        options
      ): ReturnType<ChatTransport<TMessage>["sendMessages"]> => {
        state.resumePrefix = NO_VALUE;
        return await host.transport.sendMessages({
          ...options,
          messageId:
            spec.messageId === NO_VALUE && options.trigger === "submit-message"
              ? NO_VALUE
              : options.messageId,
        });
      },
    };
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

  public async start(options?: RequestReader): Promise<void> {
    await this.sendMessage(NO_VALUE, options);
  }
  public async startWithMessage(
    message: NonNullable<
      Parameters<
        AbstractChat<TMessage>["sendMessage"]
      >[typeof FIRST_PARAMETER_INDEX]
    >,
    options?: RequestReader
  ): Promise<void> {
    await this.sendMessage(message, options);
  }
  public async regenerateMessage(
    messageId: string,
    options?: RequestReader
  ): Promise<void> {
    await this.regenerate({ ...options, messageId });
  }
}

export { ThreadRunChat };

export type { ThreadRunSpec, ThreadRunHost, RequestReader };
