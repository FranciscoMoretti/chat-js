import {
  convertFileListToFileUIParts,
  DefaultChatTransport,
  generateId,
  isToolUIPart,
} from "ai";
import type {
  AbstractChat,
  ChatInit,
  ChatRequestOptions,
  ChatStatus,
  ChatTransport,
  UIMessage,
} from "ai";

import { ThreadRunChat } from "./ai-sdk-run-chat";
import type { ThreadRunHost, ThreadRunSpec } from "./ai-sdk-run-chat";
import { MessageTree } from "./message-tree";
import { RunRegistry } from "./run-registry";
import type { RunRecord } from "./run-registry";
import type {
  MessageTreeSnapshot,
  ThreadConcurrency,
  ThreadRunHandle,
  ThreadRun,
  ThreadStartRunOptions,
  ThreadState,
  ThreadStateSnapshot,
  TreeSendOptions,
} from "./types";

type AbstractThreadOptions<TMessage extends UIMessage> = Omit<
  ChatInit<TMessage>,
  "messages"
> & {
  concurrency?: ThreadConcurrency;
  state: ThreadState<TMessage>;
};

const ownedThreadStates = new WeakSet<object>();

/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
type SendMessageInput<TMessage extends UIMessage> = Parameters<
  AbstractChat<TMessage>["sendMessage"]
>[0];
/* oxlint-enable eslint/no-magic-numbers */

/* oxlint-disable typescript/prefer-readonly-parameter-types -- ChatInit/ThreadState/ChatTransport boundaries use mutable TMessage arrays and SDK callback payloads; atomic snapshot updates retain those types. Reader-only parameter narrowing is tracked in #622. */
const getInputMessageId = <TMessage extends UIMessage>(
  input: NonNullable<SendMessageInput<TMessage>>
): string | undefined =>
  "id" in input ? (input.id ?? input.messageId) : input.messageId;
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-disable typescript/prefer-readonly-parameter-types -- ChatInit/ThreadState/ChatTransport boundaries use mutable TMessage arrays and SDK callback payloads; atomic snapshot updates retain those types. Reader-only parameter narrowing is tracked in #622. */
// Like AI SDK's AbstractChat, construction crosses a generic boundary here:
// TMessage may narrow metadata or parts beyond the base UIMessage shape.
// oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- The thread preserves its caller-selected message specialization across the SDK base-message adapter.
const specializeMessage = <TMessage extends UIMessage>(
  message: UIMessage
): TMessage =>
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The thread owns validation of its selected message specialization; this adapter preserves that generic public type across the AI SDK base message boundary.
  message as TMessage;
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-disable eslint/no-undefined -- Undefined represents an omitted optional argument or absent value in the existing TypeScript/SDK contract. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- ChatInit/ThreadState/ChatTransport boundaries use mutable TMessage arrays and SDK callback payloads; atomic snapshot updates retain those types. Reader-only parameter narrowing is tracked in #622. */
const createMessageFromInput = async <TMessage extends UIMessage>({
  fallbackId,
  input,
}: {
  fallbackId: string;
  input: NonNullable<SendMessageInput<TMessage>>;
}): Promise<TMessage> => {
  const messageId = getInputMessageId(input) ?? fallbackId;
  const { metadata } = input;
  if ("text" in input || "files" in input) {
    const fileParts = Array.isArray(input.files)
      ? input.files
      : await convertFileListToFileUIParts(input.files);
    return specializeMessage<TMessage>({
      id: messageId,
      metadata,
      parts: [
        ...fileParts,
        ...("text" in input && input.text !== undefined && input.text !== null
          ? [{ text: input.text, type: "text" as const }]
          : []),
      ],
      role: "user",
    });
  }
  return specializeMessage<TMessage>({
    ...input,
    id: messageId,
    metadata,
    role: input.role ?? "user",
  });
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-undefined */

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the ordered validation, state transitions, and cleanup in one operation so their sequencing remains reviewable. */
/* oxlint-disable eslint/init-declarations -- The value is assigned by the following guarded operation; an invented initial value would hide an uninitialized control-flow branch. */
/* oxlint-disable eslint/no-undefined -- Undefined represents an omitted optional argument or absent value in the existing TypeScript/SDK contract. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/* oxlint-disable eslint/no-continue -- Skipping an ineligible item here keeps the remaining per-item operation inside the same loop and cleanup scope. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- ChatInit/ThreadState/ChatTransport boundaries use mutable TMessage arrays and SDK callback payloads; atomic snapshot updates retain those types. Reader-only parameter narrowing is tracked in #622. */
/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
/* oxlint-disable typescript/strict-boolean-expressions -- This value-producing condition preserves the current nullish/empty sentinel behavior; coercing it would change the returned value. */
abstract class AbstractThread<TMessage extends UIMessage = UIMessage> {
  public readonly id: string;
  public readonly dataPartSchemas: AbstractThreadOptions<TMessage>["dataPartSchemas"];
  public readonly generateMessageId: NonNullable<
    AbstractThreadOptions<TMessage>["generateId"]
  >;
  public readonly messageMetadataSchema: AbstractThreadOptions<TMessage>["messageMetadataSchema"];
  public onData: AbstractThreadOptions<TMessage>["onData"];
  public onError: AbstractThreadOptions<TMessage>["onError"];
  public onFinish: AbstractThreadOptions<TMessage>["onFinish"];
  public onToolCall: AbstractThreadOptions<TMessage>["onToolCall"];
  public sendAutomaticallyWhen: AbstractThreadOptions<TMessage>["sendAutomaticallyWhen"];
  public transport: ChatTransport<TMessage>;

  readonly #runHost: ThreadRunHost<TMessage>;
  readonly #runs: RunRegistry<TMessage>;
  readonly #state: ThreadState<TMessage>;

  protected constructor(options: AbstractThreadOptions<TMessage>) {
    this.id = options.id ?? generateId();
    this.dataPartSchemas = options.dataPartSchemas;
    this.generateMessageId = options.generateId ?? generateId;
    this.messageMetadataSchema = options.messageMetadataSchema;
    this.onData = options.onData;
    this.onError = options.onError;
    this.onFinish = options.onFinish;
    this.onToolCall = options.onToolCall;
    this.sendAutomaticallyWhen = options.sendAutomaticallyWhen;
    this.transport = options.transport ?? new DefaultChatTransport();
    this.#runs = new RunRegistry(options.concurrency);
    this.#state = options.state;
    this.#runHost = AbstractThread.createRunHost(this);
    if (ownedThreadStates.has(options.state)) {
      throw new Error(
        "ThreadState is already attached to an AbstractThread; retain and reuse that controller"
      );
    }
    ownedThreadStates.add(options.state);
    try {
      this.publish();
    } catch (error) {
      ownedThreadStates.delete(options.state);
      throw error;
    }
  }

  public getSnapshot = (): ThreadStateSnapshot<TMessage> =>
    this.#state.getSnapshot();

  public subscribe = (listener: () => void): (() => void) =>
    this.#state.subscribe(listener);

  public addMessage(message: TMessage, parentId: string | null): void {
    this.upsertMessage(message, parentId);
  }

  public addToolApprovalResponse: AbstractChat<TMessage>["addToolApprovalResponse"] =
    async (response): Promise<void> => {
      const run = this.getOrCreateRunForApproval(response.id);
      await run.chat.addToolApprovalResponse(response);
    };

  public addToolOutput: AbstractChat<TMessage>["addToolOutput"] = async (
    output
  ): Promise<void> => {
    const run = this.getOrCreateRunForToolCall(output.toolCallId);
    await run.chat.addToolOutput(output);
  };

  public addToolResult: AbstractChat<TMessage>["addToolResult"] =
    this.addToolOutput;

  public getTreeSnapshot(): MessageTreeSnapshot<TMessage> {
    return this.readTree((tree) => tree.getSnapshot());
  }

  public getChildren(messageId: string | null): TMessage[] {
    return this.readTree((tree) => tree.getChildren(messageId));
  }

  public getLeaves(messageId: string | null = null): TMessage[] {
    return this.readTree((tree) => tree.getLeaves(messageId));
  }

  public getMessage(messageId: string): TMessage | undefined {
    return this.readTree((tree) => tree.getMessage(messageId));
  }

  public getParent(messageId: string): TMessage | undefined {
    return this.readTree((tree) => tree.getParent(messageId));
  }

  public getPath(messageId?: string | null): TMessage[] {
    return this.readTree((tree) => tree.getPath(messageId));
  }

  public getSiblings(messageId: string): TMessage[] {
    return this.readTree((tree) => tree.getSiblings(messageId));
  }

  public setActiveRun(runId: string): void {
    const run = this.#runs.require(runId);
    this.updateTree((tree): void => {
      tree.setCursor(run.spec.messageId ?? run.spec.initialPathMessageId);
      this.#runs.select(runId);
    });
  }

  public setCursor(messageId: string | null): void {
    this.#runs.select(null);
    this.updateTree((tree): void => tree.setCursor(messageId));
  }

  public setCursorToParentOf(messageId: string): void {
    this.#runs.select(null);
    this.updateTree((tree): void => tree.setCursorToParentOf(messageId));
  }

  private getMessagePath(messageId: string | null): TMessage[] {
    return this.readTree((tree) => tree.getPath(messageId));
  }

  private writeRunMessage(runId: string, message: TMessage): void {
    const run = this.#runs.require(runId);
    this.updateTree((tree): void => {
      const currentMessageId = run.spec.messageId;
      if (
        typeof currentMessageId === "string" &&
        currentMessageId !== "" &&
        currentMessageId !== message.id
      ) {
        throw new Error(
          `Run ${runId} is already bound to message ${currentMessageId}`
        );
      }
      if (!(typeof currentMessageId === "string" && currentMessageId !== "")) {
        const existingMessage = tree.getMessage(message.id);
        if (existingMessage) {
          throw new Error(`Message ${message.id} already exists`);
        }
        run.spec.messageId = message.id;
      }

      const insertionIndex = this.#runs.getInsertionIndex({
        childIds: tree
          .getChildren(run.spec.parentMessageId)
          .map((child): string => child.id),
        parentMessageId: run.spec.parentMessageId,
        siblingOrder: run.spec.siblingOrder,
      });
      tree.upsertMessage(message, run.spec.parentMessageId, {
        index: insertionIndex,
      });
      this.indexMessageOwnership(runId, message);
      if (
        this.#runs.isExplicitlySelected(runId) &&
        tree.cursorId === run.spec.initialPathMessageId
      ) {
        tree.setCursor(message.id);
      }
    });
  }

  public regenerate: AbstractChat<TMessage>["regenerate"] = async ({
    messageId,
    ...options
  } = {}): Promise<void> => {
    const { parentMessageId, target } = this.readTree((tree) => {
      let selectedTarget: TMessage | undefined;
      if (messageId === undefined || messageId === null) {
        selectedTarget =
          typeof tree.cursorId === "string" && tree.cursorId !== ""
            ? tree.getMessage(tree.cursorId)
            : undefined;
      } else {
        selectedTarget = tree.getMessage(messageId);
      }
      let targetParentMessageId: string | null = null;
      if (selectedTarget) {
        targetParentMessageId =
          selectedTarget.role === "assistant"
            ? (tree.getParentId(selectedTarget.id) ?? null)
            : selectedTarget.id;
      }
      return { parentMessageId: targetParentMessageId, target: selectedTarget };
    });
    if (!target) {
      throw new Error(`message ${messageId} not found`);
    }

    if (target.role === "assistant") {
      if (typeof parentMessageId === "string" && parentMessageId !== "") {
        this.#runs.assertHasCapacity(parentMessageId);
      } else {
        this.#runs.assertHasCapacity(null);
      }
    } else {
      this.assertCanGenerateFrom(target);
    }

    const spec: ThreadRunSpec = {
      id: this.#runs.reserveId(this.generateMessageId),
      initialPathMessageId: target.id,
      parentMessageId,
      siblingOrder: this.#runs.reserveSiblingOrder(
        parentMessageId,
        this.getChildren(parentMessageId).length
      ),
    };
    this.#runs.select(spec.id);
    this.updateTree((tree): void => tree.setCursor(target.id));
    const run = this.startRunRequest(spec, (chat): Promise<void> =>
      chat.regenerateMessage(target.id, options)
    );
    await run.finished;
  };

  public upsertMessage(message: TMessage, parentId: string | null): void {
    this.updateTree((tree): void => tree.upsertMessage(message, parentId));
  }

  public removeMessage(messageId: string): void {
    this.updateTree((tree): void => tree.removeLeaf(messageId));
  }

  private updateRunPath(messages: TMessage[]): void {
    this.updateTree((tree): void => tree.updatePath(messages));
  }

  public resumeStream: AbstractChat<TMessage>["resumeStream"] = async (
    options = {}
  ): Promise<void> => {
    const run =
      this.getSelectedRunRecord() ?? this.createRunForSelectedAssistant();
    if (!run) {
      return;
    }
    await this.resumeRunRequest(run, options);
  };

  public resumeRun = async (
    runId: string,
    options: ChatRequestOptions = {}
  ): Promise<void> => {
    await this.resumeRunRequest(this.#runs.require(runId), options);
  };

  public restore(snapshot: MessageTreeSnapshot<TMessage>): void {
    this.assertCanResetTree();
    this.#runs.clear();
    this.updateTree((tree): void => tree.restore(snapshot));
  }

  public setMessages(
    messages: TMessage[] | ((messages: TMessage[]) => TMessage[])
  ): void {
    const nextMessages =
      typeof messages === "function"
        ? messages(this.getSnapshot().messages)
        : messages;
    this.#runs.select(null);
    this.updateTree((tree): void => tree.setPath(nextMessages));
  }

  public sendMessage = async (
    input?: SendMessageInput<TMessage>,
    options?: TreeSendOptions
  ): Promise<void> => {
    const { tree, ...request } = options ?? {};
    if (!input) {
      const cursorId =
        tree && "from" in tree
          ? (tree.from ?? null)
          : this.getSnapshot().cursorId;
      const cursorMessage =
        typeof cursorId === "string" && cursorId !== ""
          ? this.getMessage(cursorId)
          : undefined;
      if (cursorMessage?.role === "assistant") {
        const run = this.continueAssistant({
          follow: tree?.follow ?? cursorId === this.getSnapshot().cursorId,
          messageId: cursorMessage.id,
          options: request,
        });
        await run.finished;
        return;
      }
    }
    const run = await this.startRun({
      follow: tree?.follow,
      from: tree && "from" in tree ? (tree.from ?? null) : undefined,
      message: input,
      request,
    });
    await run.finished;
  };

  public startRun = async ({
    follow: requestedFollow,
    from,
    message: input,
    request: options,
  }: ThreadStartRunOptions<TMessage> = {}): Promise<ThreadRunHandle> => {
    const { cursorId, originMessage } = this.readTree((tree) => {
      const originCursorId = from === undefined ? tree.cursorId : from;
      return {
        cursorId: originCursorId,
        originMessage:
          typeof originCursorId === "string" && originCursorId !== ""
            ? tree.getMessage(originCursorId)
            : undefined,
      };
    });
    if (typeof cursorId === "string" && cursorId !== "" && !originMessage) {
      throw new Error(`Unknown message ${cursorId}`);
    }
    const activeCursorId = this.getSnapshot().cursorId;
    const follow = requestedFollow ?? cursorId === activeCursorId;

    if (!input) {
      if (!originMessage) {
        throw new Error("Select a message before starting a run");
      }
      this.assertCanGenerateFrom(originMessage);
      return this.startRunFromParent({
        follow,
        id: this.#runs.reserveId(this.generateMessageId),
        options,
        parentMessageId: originMessage.id,
      });
    }

    const message = await createMessageFromInput({
      fallbackId: getInputMessageId(input) ?? this.generateMessageId(),
      input,
    });
    if (message.role === "assistant") {
      return this.startAssistantMessage({
        follow,
        message,
        options,
        parentMessageId: cursorId,
      });
    }
    this.assertCanGenerateFrom(message);
    this.updateTree((tree): void => {
      const existingMessage = tree.getMessage(message.id);
      const attachmentId = existingMessage
        ? (tree.getParentId(message.id) ?? null)
        : cursorId;
      tree.upsertMessage(message, attachmentId);
      if (follow) {
        tree.setCursor(message.id);
      }
    });

    return this.startRunFromParent({
      follow,
      id: this.#runs.reserveId(this.generateMessageId),
      options,
      parentMessageId: message.id,
    });
  };

  public clearError = (): void => {
    const run = this.getSelectedRunRecord();
    if (run) {
      run.chat.clearError();
    }
  };

  public stop = (): Promise<void> =>
    this.getSelectedRunRecord()?.chat.stop() ?? Promise.resolve();

  public async stopAll(): Promise<void> {
    await Promise.all(
      this.#runs.getActive().map((run): Promise<void> => run.chat.stop())
    );
  }

  public stopRun(runId: string): Promise<void> {
    return this.#runs.get(runId)?.chat.stop() ?? Promise.resolve();
  }

  public stopRunForMessage(messageId: string): Promise<void> {
    const run = this.getRunForMessage(messageId);
    return run ? this.stopRun(run.id) : Promise.resolve();
  }

  public getRun(runId: string): ThreadRun | undefined {
    const run = this.#runs.get(runId);
    return run ? RunRegistry.toSnapshot(run) : undefined;
  }

  public getRunForMessage(messageId: string): ThreadRun | undefined {
    const run = this.#runs.getForMessage(messageId);
    return run ? RunRegistry.toSnapshot(run) : undefined;
  }

  private setRunError(runId: string, error: Error | undefined): void {
    this.#runs.setError(runId, error);
    this.publish();
  }

  private setRunStatus(runId: string, status: ChatStatus): void {
    this.#runs.setStatus(runId, status);
    this.publish();
  }

  private registerToolCall(runId: string, toolCallId: string): void {
    this.#runs.registerToolCall(runId, toolCallId);
  }

  private indexMessageOwnership(runId: string, message: TMessage): void {
    this.#runs.indexMessageOwnership(runId, message);
  }

  private buildSnapshot(
    tree: MessageTree<TMessage>
  ): ThreadStateSnapshot<TMessage> {
    const treeSnapshot = tree.getSnapshot();
    const indexes = tree.getIndexes();
    const runSnapshot = this.#runs.getSnapshot();
    const selectedRun = this.getSelectedRunRecord(tree);
    return {
      ...treeSnapshot,
      ...indexes,
      activeRuns: runSnapshot.activeRuns,
      error: selectedRun?.error,
      messages: tree.getPath(),
      runs: runSnapshot.runs,
      status: selectedRun?.status ?? "ready",
      treeStatus: runSnapshot.status,
    };
  }

  private createTree(
    snapshot?: ThreadStateSnapshot<TMessage>
  ): MessageTree<TMessage> {
    const resolvedSnapshot = snapshot ?? this.#state.getSnapshot();
    return new MessageTree<TMessage>({ snapshot: resolvedSnapshot });
  }

  private static createRunHost<TMessage extends UIMessage>(
    thread: AbstractThread<TMessage>
  ): ThreadRunHost<TMessage> {
    return {
      get dataPartSchemas(): ThreadRunHost<TMessage>["dataPartSchemas"] {
        return thread.dataPartSchemas;
      },
      generateMessageId: (): string => thread.generateMessageId(),
      getMessagePath: (messageId): TMessage[] =>
        thread.getMessagePath(messageId),
      get id(): string {
        return thread.id;
      },
      get messageMetadataSchema(): ThreadRunHost<TMessage>["messageMetadataSchema"] {
        return thread.messageMetadataSchema;
      },
      get onData(): ThreadRunHost<TMessage>["onData"] {
        return thread.onData;
      },
      set onData(handler) {
        thread.onData = handler;
      },
      get onError(): ThreadRunHost<TMessage>["onError"] {
        return thread.onError;
      },
      set onError(handler) {
        thread.onError = handler;
      },
      get onFinish(): ThreadRunHost<TMessage>["onFinish"] {
        return thread.onFinish;
      },
      set onFinish(handler) {
        thread.onFinish = handler;
      },
      get onToolCall(): ThreadRunHost<TMessage>["onToolCall"] {
        return thread.onToolCall;
      },
      set onToolCall(handler) {
        thread.onToolCall = handler;
      },
      registerToolCall: (runId, toolCallId): void =>
        thread.registerToolCall(runId, toolCallId),
      removeMessage: (messageId): void => thread.removeMessage(messageId),
      get sendAutomaticallyWhen(): ThreadRunHost<TMessage>["sendAutomaticallyWhen"] {
        return thread.sendAutomaticallyWhen;
      },
      set sendAutomaticallyWhen(handler) {
        thread.sendAutomaticallyWhen = handler;
      },
      setRunError: (runId, error): void => thread.setRunError(runId, error),
      setRunStatus: (runId, status): void => thread.setRunStatus(runId, status),
      get transport(): ThreadRunHost<TMessage>["transport"] {
        return thread.transport;
      },
      set transport(transport) {
        thread.transport = transport;
      },
      updateRunPath: (messages): void => thread.updateRunPath(messages),
      writeRunMessage: (runId, message): void =>
        thread.writeRunMessage(runId, message),
    };
  }

  private publish(): void {
    this.updateState((snapshot) =>
      this.buildSnapshot(this.createTree(snapshot))
    );
  }

  private readTree<TResult>(
    reader: (tree: MessageTree<TMessage>) => TResult
  ): TResult {
    return reader(this.createTree());
  }

  private updateTree<TResult>(
    updater: (tree: MessageTree<TMessage>) => TResult
  ): TResult {
    const completed: { value: TResult }[] = [];
    this.updateState((snapshot) => {
      const tree = this.createTree(snapshot);
      const value = updater(tree);
      completed.push({ value });
      return this.buildSnapshot(tree);
    });
    const [result] = completed;
    if (!result) {
      throw new Error("ThreadState update did not complete");
    }
    return result.value;
  }

  private updateState(
    updater: (
      snapshot: ThreadStateSnapshot<TMessage>
    ) => ThreadStateSnapshot<TMessage>
  ): void {
    let calls = 0;
    this.#state.update((snapshot) => {
      calls += 1;
      return updater(snapshot);
    });
    if (calls !== 1) {
      throw new Error(
        "ThreadState.update must invoke its updater exactly once and synchronously"
      );
    }
  }

  private assertCanGenerateFrom(parentMessage: TMessage): void {
    AbstractThread.assertValidRunParent(parentMessage);
    this.#runs.assertHasCapacity(parentMessage.id);
  }

  private static assertValidRunParent(message: UIMessage): void {
    if (message.role === "assistant") {
      throw new Error(
        `Cannot start a new run directly from assistant message ${message.id}; attach an input message first`
      );
    }
  }

  private getSelectedRunRecord(
    tree = this.createTree()
  ): RunRecord<TMessage> | undefined {
    return this.#runs.resolveSelected({
      cursorId: tree.cursorId,
      pathIds: new Set(tree.getPathIds()),
    });
  }

  private findAssistantOwningPart({
    id,
    label,
    matches,
  }: {
    id: string;
    label: string;
    matches: (part: TMessage["parts"][number]) => boolean;
  }): TMessage | undefined {
    let owner: TMessage | undefined;
    for (const { message } of this.getTreeSnapshot().nodes) {
      if (message.role !== "assistant" || !message.parts.some(matches)) {
        continue;
      }
      if (owner && owner.id !== message.id) {
        throw new Error(
          `${label} ${id} appears in more than one assistant message`
        );
      }
      owner = message;
    }
    return owner;
  }

  private getOrCreateRunForApproval(approvalId: string): RunRecord<TMessage> {
    const existing = this.#runs.findForApproval(approvalId);
    if (existing) {
      return existing;
    }
    const owner = this.findAssistantOwningPart({
      id: approvalId,
      label: "Tool approval",
      matches: (part): boolean =>
        isToolUIPart(part) && part.approval?.id === approvalId,
    });
    if (!owner) {
      throw new Error(`No run owns tool approval ${approvalId}`);
    }
    const run = this.createRunForAssistant(owner.id);
    if (!run) {
      throw new Error(`Assistant message ${owner.id} cannot own a run`);
    }
    return run;
  }

  private getOrCreateRunForToolCall(toolCallId: string): RunRecord<TMessage> {
    const existing = this.#runs.findForToolCall(toolCallId);
    if (existing) {
      return existing;
    }
    const owner = this.findAssistantOwningPart({
      id: toolCallId,
      label: "Tool call",
      matches: (part): boolean =>
        isToolUIPart(part) && part.toolCallId === toolCallId,
    });
    if (!owner) {
      throw new Error(`No run owns tool call ${toolCallId}`);
    }
    const run = this.createRunForAssistant(owner.id);
    if (!run) {
      throw new Error(`Assistant message ${owner.id} cannot own a run`);
    }
    return run;
  }

  private createRunForSelectedAssistant(): RunRecord<TMessage> | undefined {
    const tree = this.createTree();
    const messageId = tree.cursorId;
    if (!(typeof messageId === "string" && messageId !== "")) {
      return;
    }
    // oxlint-disable-next-line typescript/consistent-return -- This lookup or optional operation intentionally returns no value when the target is absent; callers already handle the value-or-undefined contract.
    return this.createRunForAssistant(messageId, true);
  }

  private createRunForAssistant(
    messageId: string,
    select = false
  ): RunRecord<TMessage> | undefined {
    const existing = this.#runs.getForResponseMessage(messageId);
    if (existing) {
      if (select) {
        this.#runs.select(existing.spec.id);
      }
      return existing;
    }
    const tree = this.createTree();
    const message = tree.getMessage(messageId);
    if (!message || message.role !== "assistant") {
      // oxlint-disable-next-line typescript/consistent-return -- This lookup or optional operation intentionally returns no value when the target is absent; callers already handle the value-or-undefined contract.
      return;
    }
    const parentMessageId = tree.getParentId(messageId) ?? null;
    const siblingOrder = tree
      .getChildren(parentMessageId)
      .findIndex((child): boolean => child.id === messageId);
    if (siblingOrder === -1) {
      throw new Error(`Message ${messageId} is missing from its sibling order`);
    }

    const spec: ThreadRunSpec = {
      id: this.#runs.reserveId(this.generateMessageId),
      initialPathMessageId: messageId,
      messageId,
      parentMessageId,
      siblingOrder,
    };
    const record: RunRecord<TMessage> = {
      chat: new ThreadRunChat(this.#runHost, spec),
      error: undefined,
      finished: Promise.resolve(),
      spec,
      status: "ready",
    };
    this.#runs.add(record);
    if (select) {
      this.#runs.select(spec.id);
    }
    this.indexMessageOwnership(spec.id, message);
    this.publish();
    return record;
  }

  private assertCanResetTree(): void {
    if (this.#runs.getActive().length > 0) {
      throw new Error("Cannot replace the tree while runs are active");
    }
  }

  private startRunFromParent({
    follow,
    id,
    options,
    parentMessageId,
  }: Omit<
    ThreadRunSpec,
    "initialPathMessageId" | "messageId" | "parentMessageId" | "siblingOrder"
  > & {
    follow: boolean;
    options?: ChatRequestOptions;
    parentMessageId: string;
  }): ThreadRunHandle {
    const spec: ThreadRunSpec & { parentMessageId: string } = {
      id,
      initialPathMessageId: parentMessageId,
      parentMessageId,
      siblingOrder: this.#runs.reserveSiblingOrder(
        parentMessageId,
        this.getChildren(parentMessageId).length
      ),
    };
    if (follow) {
      this.#runs.select(id);
      this.updateTree((tree): void => tree.setCursor(parentMessageId));
    }
    return this.startRunRequest(spec, (chat): Promise<void> =>
      chat.start(options)
    );
  }

  private startRunRequest(
    spec: ThreadRunSpec,
    start: (chat: ThreadRunChat<TMessage>) => Promise<void>
  ): ThreadRunHandle {
    if (
      typeof spec.parentMessageId === "string" &&
      spec.parentMessageId !== "" &&
      !this.getMessage(spec.parentMessageId)
    ) {
      throw new Error(`Unknown message ${spec.parentMessageId}`);
    }
    const chat = new ThreadRunChat(this.#runHost, spec);
    const record: RunRecord<TMessage> = {
      chat,
      error: undefined,
      finished: Promise.resolve(),
      spec,
      status: "submitted",
    };
    this.#runs.add(record);
    this.publish();
    const finished = this.publishWhenFinished(start(chat));
    // Callers can still await detached startRun calls through the finished promise.
    void (async (): Promise<void> => {
      try {
        await finished;
      } catch {
        // The original finished promise retains the rejection for callers.
      }
    })();
    record.finished = finished;
    return this.createRunHandle(record);
  }

  private continueAssistant({
    follow,
    messageId,
    options,
  }: {
    follow: boolean;
    messageId: string;
    options?: ChatRequestOptions;
  }): ThreadRunHandle {
    const existing = this.#runs.getForResponseMessage(messageId);
    if (existing?.status === "submitted" || existing?.status === "streaming") {
      throw new Error(
        `Assistant message ${messageId} already has an active run`
      );
    }
    if (existing) {
      this.#runs.assertHasCapacity(existing.spec.parentMessageId);
    } else {
      const tree = this.createTree();
      const message = tree.getMessage(messageId);
      if (!message || message.role !== "assistant") {
        throw new Error(`Message ${messageId} is not an assistant message`);
      }
      this.#runs.assertHasCapacity(tree.getParentId(messageId) ?? null);
    }

    const run = this.createRunForAssistant(messageId);
    if (!run) {
      throw new Error(`Message ${messageId} is not an assistant message`);
    }
    if (follow) {
      this.#runs.select(run.spec.id);
      this.updateTree((tree): void => tree.setCursor(messageId));
    }
    const finished = this.publishWhenFinished(run.chat.start(options));
    run.finished = finished;
    this.publish();
    return this.createRunHandle(run);
  }

  private startAssistantMessage({
    follow,
    message,
    options,
    parentMessageId,
  }: {
    follow: boolean;
    message: TMessage;
    options?: ChatRequestOptions;
    parentMessageId: string | null;
  }): ThreadRunHandle {
    this.#runs.assertHasCapacity(parentMessageId);
    const spec: ThreadRunSpec = {
      id: this.#runs.reserveId(this.generateMessageId),
      initialPathMessageId: parentMessageId,
      messageId: message.id,
      parentMessageId,
      siblingOrder: this.#runs.reserveSiblingOrder(
        parentMessageId,
        this.getChildren(parentMessageId).length
      ),
    };
    if (follow) {
      this.#runs.select(spec.id);
    }
    return this.startRunRequest(spec, (chat): Promise<void> =>
      chat.startWithMessage(message, options)
    );
  }

  private createRunHandle(run: RunRecord<TMessage>): ThreadRunHandle {
    return {
      get finished(): Promise<void> {
        return run.finished;
      },
      getSnapshot: (): ThreadRun | undefined => this.getRun(run.spec.id),
      id: run.spec.id,
      stop: (): Promise<void> => run.chat.stop(),
    };
  }

  private async publishWhenFinished<TValue>(
    promise: Promise<TValue>
  ): Promise<TValue> {
    try {
      return await promise;
    } finally {
      this.publish();
    }
  }

  private async resumeRunRequest(
    run: RunRecord<TMessage>,
    options: ChatRequestOptions
  ): Promise<void> {
    this.#runs.assertHasCapacity(run.spec.parentMessageId);
    run.chat.refreshPath();
    const finished = this.publishWhenFinished(run.chat.resumeStream(options));
    run.finished = finished;
    this.publish();
    await finished;
  }
}
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-continue */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/no-undefined */
/* oxlint-enable eslint/init-declarations */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable unicorn/no-null */
/* oxlint-enable eslint/max-statements */

/* oxlint-disable max-lines -- Keep this cohesive contract and its cases together; splitting it solely for a line quota would obscure shared setup or state transitions. */

export { AbstractThread };
