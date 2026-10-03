import { AbstractChat } from "ai";
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import type {
  ChatInit,
  ChatRequestOptions,
  ChatStatus,
  ChatTransport,
  UIMessage,
  UIMessageChunk,
} from "ai";
/* oxlint-enable eslint/sort-imports */

import { ThreadRunState } from "./thread-run-state";

/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
/* oxlint-disable typescript/consistent-type-definitions -- Keep this structural alias closed to declaration merging and compatible with the existing generic/record API. */
export type ThreadRunSpec = {
  id: string;
  initialPathMessageId: string | null;
  messageId?: string;
  parentMessageId: string | null;
  siblingOrder: number;
};
/* oxlint-enable typescript/consistent-type-definitions */
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
export interface ThreadRunHost<TMessage extends UIMessage> {
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
  setRunError: (runId: string, error: Error | undefined) => void;
  setRunStatus: (runId: string, status: ChatStatus) => void;
  writeRunMessage: (runId: string, message: TMessage) => void;
}
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/group-exports */

/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the ordered validation, state transitions, and cleanup in one operation so their sequencing remains reviewable. */
/* oxlint-disable oxc/no-async-await -- Await preserves the existing sequencing, rejection propagation, and cleanup behavior of this asynchronous operation. */
/* oxlint-disable eslint/no-undefined -- Undefined represents an omitted optional argument or absent value in the existing TypeScript/SDK contract. */
/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/* oxlint-disable oxc/no-optional-chaining -- Optional access deliberately propagates absence from the external or partially initialized data contract. */
/* oxlint-disable oxc/no-rest-spread-properties -- Copying these properties preserves immutable updates and the existing structural API without mutating the source object. */
/* oxlint-disable eslint/no-ternary -- This expression selects a value without introducing mutable intermediate state or changing evaluation order. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
export class ThreadRunChat<
  TMessage extends UIMessage,
> extends AbstractChat<TMessage> {
  readonly #state: ThreadRunState<TMessage>;

  public constructor(host: ThreadRunHost<TMessage>, spec: ThreadRunSpec) {
    const responseMessageId = host.generateMessageId();
    const state = new ThreadRunState(host, spec);
    const transport: ChatTransport<TMessage> = {
      reconnectToStream: async (options) => {
        state.resumePrefix = undefined;
        const stream = await host.transport.reconnectToStream(options);
        state.preserveReconnectError =
          stream === null && state.status === "error";
        if (!stream) {
          return null;
        }
        const lastMessage = state.messages.at(-1);
        let first = true;
        return stream.pipeThrough(
          new TransformStream<UIMessageChunk, UIMessageChunk>({
            transform(chunk, controller): void {
              let chunkToEnqueue = chunk;
              if (
                first &&
                chunk.type === "start" &&
                lastMessage?.role === "assistant"
              ) {
                chunkToEnqueue = {
                  ...chunk,
                  messageId: chunk.messageId ?? lastMessage.id,
                  messageMetadata:
                    chunk.messageMetadata ?? lastMessage.metadata,
                };
              }
              // Full replay starts with `start`. A continuation needs the canonical
              // identity and prefix because SDK 7 initializes empty resume state.
              if (
                first &&
                chunk.type !== "start" &&
                lastMessage?.role === "assistant"
              ) {
                state.resumePrefix = structuredClone(lastMessage);
                controller.enqueue({
                  messageId: lastMessage.id,
                  messageMetadata: lastMessage.metadata,
                  type: "start",
                });
              }
              first = false;
              controller.enqueue(chunkToEnqueue);
            },
          })
        );
      },
      sendMessages: (options) => {
        state.resumePrefix = undefined;
        return host.transport.sendMessages({
          ...options,
          messageId:
            spec.messageId === undefined && options.trigger === "submit-message"
              ? undefined
              : options.messageId,
        });
      },
    };
    super({
      dataPartSchemas: host.dataPartSchemas,
      generateId: (): string => responseMessageId,
      id: host.id,
      messageMetadataSchema: host.messageMetadataSchema,
      onData: (event) => host.onData?.(event),
      onError: (error): void => {
        host.onError?.(error);
      },
      onFinish: (event): void => {
        host.onFinish?.({
          ...event,
          messages: host.getMessagePath(spec.messageId ?? spec.parentMessageId),
        });
      },
      onToolCall: async (event): Promise<void> => {
        host.registerToolCall(spec.id, event.toolCall.toolCallId);
        await host.onToolCall?.(event);
      },
      sendAutomaticallyWhen: (event) =>
        host.sendAutomaticallyWhen?.(event) ?? false,
      state,
      transport,
    });
    this.#state = state;
  }

  protected override setStatus(options: {
    status: ChatStatus;
    error?: Error;
  }): void {
    if (this.#state.preserveReconnectError && options.status === "ready") {
      this.#state.preserveReconnectError = false;
      return;
    }
    super.setStatus(options);
  }

  public refreshPath(): void {
    this.#state.refreshPath();
  }

  public start(options?: ChatRequestOptions): Promise<void> {
    return this.sendMessage(undefined, options);
  }

  public startWithMessage(
    message: NonNullable<Parameters<AbstractChat<TMessage>["sendMessage"]>[0]>,
    options?: ChatRequestOptions
  ): Promise<void> {
    return this.sendMessage(message, options);
  }

  public regenerateMessage(
    messageId: string,
    options?: ChatRequestOptions
  ): Promise<void> {
    return this.regenerate({ ...options, messageId });
  }
}
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-ternary */
/* oxlint-enable oxc/no-rest-spread-properties */
/* oxlint-enable oxc/no-optional-chaining */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable unicorn/no-null */
/* oxlint-enable eslint/no-undefined */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable import/no-named-export */
