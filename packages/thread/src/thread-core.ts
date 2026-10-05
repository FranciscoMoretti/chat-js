import type {
  AbstractChat,
  ChatInit,
  ChatStatus,
  ChatTransport,
  UIDataTypes,
  UIMessage,
  UITools,
} from "ai";
import {
  DefaultChatTransport,
  convertFileListToFileUIParts,
  generateId,
} from "ai";

import { ThreadRunChat } from "./ai-sdk-run-chat";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type {
  RequestReader,
  ThreadRunHost,
  ThreadRunSpec,
} from "./ai-sdk-run-chat";
/* oxlint-enable sort-imports */
import { MessageTree } from "./message-tree";
import type { SnapshotInput } from "./message-tree-readers";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { RunRecord } from "./run-registry";
/* oxlint-enable sort-imports */
import { RunRegistry } from "./run-registry";
import { ThreadRunHostAdapter } from "./thread-run-host";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type {
  MessageTreeSnapshot,
  ThreadConcurrency,
  ThreadRun,
  ThreadRunHandle,
  ThreadStartRunOptions,
  ThreadState,
  ThreadStateSnapshot,
  TreeSendOptions,
} from "./types";
/* oxlint-enable sort-imports */

const FIRST_PARAMETER_INDEX = 0;
const SECOND_PARAMETER_INDEX = 1;
const UPDATE_CALL_INCREMENT = 1;
const EXPECTED_UPDATE_CALL_COUNT = 1;
const NOT_FOUND_INDEX = -1;
const EMPTY_ACTIVE_RUN_COUNT = 0;
const EMPTY_TRANSACTION_RESULT_COUNT = 0;

type ThreadCoreOptions<TMessage extends UIMessage> = Omit<
  ChatInit<TMessage>,
  "messages"
> & {
  concurrency?: ThreadConcurrency;
  state: ThreadState<TMessage>;
};

const ownedThreadStates = new WeakSet<object>();

// Transactions use public tree methods; they do not replace tree properties.
type TreeTransaction<TMessage extends UIMessage> = Readonly<
  Pick<MessageTree<TMessage>, keyof MessageTree<TMessage>>
>;

type RunParent = Readonly<Pick<UIMessage, "id" | "role">>;

type ToolLookupPart = Readonly<{
  type: string;
  toolCallId?: string;
  approval?: Readonly<{ id: string }>;
}>;

// SDK 7's tool predicates read only the static prefix or dynamic discriminant.
const isToolLookupPart = (part: ToolLookupPart): boolean =>
  part.type.startsWith("tool-") || part.type === "dynamic-tool";

type TreeRequestReader = RequestReader & {
  readonly tree?: Readonly<NonNullable<TreeSendOptions["tree"]>>;
};

interface ResumableRun<TMessage extends UIMessage> {
  readonly chat: Readonly<
    Pick<ThreadRunChat<TMessage>, "refreshPath" | "resumeStream">
  >;
  readonly spec: Readonly<Pick<ThreadRunSpec, "parentMessageId">>;
  finished: Promise<void>;
}

type SendMessageInput<TMessage extends UIMessage> = Parameters<
  AbstractChat<TMessage>["sendMessage"]
>[typeof FIRST_PARAMETER_INDEX];

const getInputMessageId = (input: {
  readonly id?: string;
  readonly messageId?: string;
}): string | undefined =>
  "id" in input ? (input.id ?? input.messageId) : input.messageId;

// oxlint-disable-next-line unicorn/no-null -- MessageTree serializes the root parent/cursor as null; root traversal, attachment, and run capacity checks must retain that exact ID sentinel.
const ROOT_MESSAGE_ID = null;

// oxlint-disable-next-line unicorn/no-null -- RunRegistry.select uses null to clear an explicit run selection before cursor/path replacement; undefined is not its selection contract.
const NO_SELECTED_RUN = null;

// oxlint-disable-next-line eslint/no-undefined -- Files-only SDK input omits text; skip creating a text part for that exact absent value while retaining empty strings.
const ABSENT_INPUT_TEXT = undefined;

// oxlint-disable-next-line eslint/no-undefined -- A tool lookup begins without an owning assistant and returns this absent result when no matching part exists.
const NO_PART_OWNER = undefined;

// oxlint-disable-next-line eslint/no-undefined -- A cursor without an assistant, or a non-assistant lookup, has no resumable assistant run; both helpers return this optional result.
const NO_ASSISTANT_RUN = undefined;

// oxlint-disable-next-line eslint/no-undefined -- An omitted regeneration messageId selects the cursor; a missing or root cursor has no message to regenerate, continue, or use as run origin. Both optional targets use undefined.
const ABSENT_MESSAGE_TARGET = undefined;

// oxlint-disable-next-line eslint/no-undefined -- sendMessage forwards an absent tree.from option as an explicitly omitted run origin; startRun then selects the current cursor.
const OMITTED_RUN_ORIGIN = undefined;

// oxlint-disable-next-line eslint/no-undefined -- Run lookup helpers expose ThreadRun | undefined when the registry has no matching run, preserving the public optional result.
const NO_RUN_SNAPSHOT = undefined;

// oxlint-disable-next-line eslint/no-undefined -- RunRecord requires an error property even for a newly ready run; its exact no-error value is undefined, not a nullable error or omitted field.
const NO_RUN_ERROR = undefined;

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve createMessageFromInput's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- The SDK input supplies mutable parts and metadata to the constructed message without cloning their identity; recursively readonly parts cannot satisfy the SDK message result. */
const createMessageFromInput = async <
  Metadata,
  Data extends UIDataTypes,
  Tools extends UITools,
>({
  fallbackId,
  input,
}: Readonly<{
  fallbackId: string;
  input: NonNullable<SendMessageInput<UIMessage<Metadata, Data, Tools>>>;
}>): Promise<UIMessage<Metadata, Data, Tools>> => {
  const messageId = getInputMessageId(input) ?? fallbackId;
  const { metadata } = input;
  if ("text" in input || "files" in input) {
    const fileParts = Array.isArray(input.files)
      ? input.files
      : await convertFileListToFileUIParts(input.files);
    return {
      id: messageId,
      metadata,
      parts: [
        ...fileParts,
        ...("text" in input &&
        input.text !== ABSENT_INPUT_TEXT &&
        input.text !== null
          ? [{ text: input.text, type: "text" as const }]
          : []),
      ],
      role: "user",
    };
  }
  return {
    ...input,
    id: messageId,
    metadata,
    role: input.role ?? "user",
  };
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable typescript/prefer-readonly-parameter-types */

abstract class ThreadCore<
  Metadata,
  Data extends UIDataTypes,
  Tools extends UITools,
> {
  public readonly id: string;
  public readonly dataPartSchemas: ThreadCoreOptions<
    UIMessage<Metadata, Data, Tools>
  >["dataPartSchemas"];
  public readonly generateMessageId: NonNullable<
    ThreadCoreOptions<UIMessage<Metadata, Data, Tools>>["generateId"]
  >;
  public readonly messageMetadataSchema: ThreadCoreOptions<
    UIMessage<Metadata, Data, Tools>
  >["messageMetadataSchema"];
  public onData: ThreadCoreOptions<UIMessage<Metadata, Data, Tools>>["onData"];
  public onError: ThreadCoreOptions<
    UIMessage<Metadata, Data, Tools>
  >["onError"];
  public onFinish: ThreadCoreOptions<
    UIMessage<Metadata, Data, Tools>
  >["onFinish"];
  public onToolCall: ThreadCoreOptions<
    UIMessage<Metadata, Data, Tools>
  >["onToolCall"];
  public sendAutomaticallyWhen: ThreadCoreOptions<
    UIMessage<Metadata, Data, Tools>
  >["sendAutomaticallyWhen"];
  public transport: ChatTransport<UIMessage<Metadata, Data, Tools>>;

  readonly #runHost: ThreadRunHost<UIMessage<Metadata, Data, Tools>>;
  readonly #runs: RunRegistry<UIMessage<Metadata, Data, Tools>>;
  readonly #state: ThreadState<UIMessage<Metadata, Data, Tools>>;

  protected constructor(
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- The installed SDK accepts native schema and transport types; recursively readonly schema metadata cannot satisfy ChatInit or the live state host.
    options: Readonly<ThreadCoreOptions<UIMessage<Metadata, Data, Tools>>>
  ) {
    this.id = options.id ?? generateId();
    this.dataPartSchemas = options.dataPartSchemas;
    this.generateMessageId = options.generateId ?? generateId;
    this.messageMetadataSchema = options.messageMetadataSchema;
    this.updateCallbacks(options);
    this.transport = options.transport ?? new DefaultChatTransport();
    this.#runs = new RunRegistry(options.concurrency);
    this.#state = options.state;
    this.#runHost = this.#createRunHost();
    this.claimState(options);
  }

  private updateCallbacks(
    options: Readonly<
      Pick<
        ThreadCoreOptions<UIMessage<Metadata, Data, Tools>>,
        | "onData"
        | "onError"
        | "onFinish"
        | "onToolCall"
        | "sendAutomaticallyWhen"
      >
    >
  ): void {
    this.onData = options.onData;
    this.onError = options.onError;
    this.onFinish = options.onFinish;
    this.onToolCall = options.onToolCall;
    this.sendAutomaticallyWhen = options.sendAutomaticallyWhen;
  }

  private claimState(options: { readonly state: object }): void {
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

  public getSnapshot = (): ThreadStateSnapshot<
    UIMessage<Metadata, Data, Tools>
  > => this.#state.getSnapshot();

  public subscribe = (listener: () => void): (() => void) =>
    this.#state.subscribe(listener);

  public addMessage(
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- MessageTree stores the canonical SDK message; readonly nested metadata and parts cannot satisfy its native message contract.
    message: Readonly<UIMessage<Metadata, Data, Tools>>,
    parentId: string | null
  ): void {
    this.upsertMessage(message, parentId);
  }

  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve addToolApprovalResponse's awaited sequencing and rejected-Promise behavior. */
  public addToolApprovalResponse: AbstractChat<
    UIMessage<Metadata, Data, Tools>
  >["addToolApprovalResponse"] = async (
    response: Readonly<
      Omit<
        Parameters<
          AbstractChat<
            UIMessage<Metadata, Data, Tools>
          >["addToolApprovalResponse"]
        >[typeof FIRST_PARAMETER_INDEX],
        "options"
      >
    > & { readonly options?: RequestReader }
  ): Promise<void> => {
    const run = this.getOrCreateRunForApproval(response.id);
    await run.chat.addToolApprovalResponse(response);
  };
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve addToolOutput's awaited sequencing and rejected-Promise behavior. */
  public addToolOutput: AbstractChat<
    UIMessage<Metadata, Data, Tools>
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- The SDK addToolOutput callback is generic in the tool name and native output type; a deeply readonly extracted input fails both its callback assignment and SDK receiver.
  >["addToolOutput"] = async (output): Promise<void> => {
    const run = this.getOrCreateRunForToolCall(output.toolCallId);
    await run.chat.addToolOutput(output);
  };
  /* oxlint-enable oxc/no-async-await */
  public addToolResult: AbstractChat<
    UIMessage<Metadata, Data, Tools>
  >["addToolResult"] = this.addToolOutput;

  public getTreeSnapshot(): MessageTreeSnapshot<
    UIMessage<Metadata, Data, Tools>
  > {
    return this.readTree((tree) => tree.getSnapshot());
  }

  public getChildren(
    messageId: string | null
  ): UIMessage<Metadata, Data, Tools>[] {
    return this.readTree((tree) => tree.getChildren(messageId));
  }

  public getLeaves(
    messageId: string | null = ROOT_MESSAGE_ID
  ): UIMessage<Metadata, Data, Tools>[] {
    return this.readTree((tree) => tree.getLeaves(messageId));
  }

  public getMessage(
    messageId: string
  ): UIMessage<Metadata, Data, Tools> | undefined {
    return this.readTree((tree) => tree.getMessage(messageId));
  }

  public getParent(
    messageId: string
  ): UIMessage<Metadata, Data, Tools> | undefined {
    return this.readTree((tree) => tree.getParent(messageId));
  }

  public getPath(
    messageId?: string | null
  ): UIMessage<Metadata, Data, Tools>[] {
    return this.readTree((tree) => tree.getPath(messageId));
  }

  public getSiblings(messageId: string): UIMessage<Metadata, Data, Tools>[] {
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
    this.#runs.select(NO_SELECTED_RUN);
    this.updateTree((tree): void => tree.setCursor(messageId));
  }

  public setCursorToParentOf(messageId: string): void {
    this.#runs.select(NO_SELECTED_RUN);
    this.updateTree((tree): void => tree.setCursorToParentOf(messageId));
  }

  private getMessagePath(
    messageId: string | null
  ): UIMessage<Metadata, Data, Tools>[] {
    return this.readTree((tree) => tree.getPath(messageId));
  }

  private writeRunMessage(
    runId: string,
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- The live SDK response message reaches MessageTree.upsertMessage with its native metadata and parts types.
    message: Readonly<UIMessage<Metadata, Data, Tools>>
  ): void {
    const run = this.#runs.require(runId);
    this.updateTree((tree): void => {
      ThreadCore.bindRunResponse({
        messageId: message.id,
        runId,
        spec: run.spec,
        tree,
      });

      const insertionIndex = this.#runs.getInsertionIndex({
        childIds: tree
          .getChildren(run.spec.parentMessageId)
          .map((child: Readonly<Pick<UIMessage, "id">>): string => child.id),
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

  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Binding writes the existing live run spec messageId; a readonly spec forbids this required mutation before tree insertion.
  private static bindRunResponse({
    tree,
    runId,
    spec,
    messageId,
  }: Readonly<{
    tree: Readonly<Pick<MessageTree, "getMessage">>;
    runId: string;
    spec: ThreadRunSpec;
    messageId: string;
  }>): void {
    const currentMessageId = spec.messageId;
    if (
      typeof currentMessageId === "string" &&
      currentMessageId !== "" &&
      currentMessageId !== messageId
    ) {
      throw new Error(
        `Run ${runId} is already bound to message ${currentMessageId}`
      );
    }
    if (!(typeof currentMessageId === "string" && currentMessageId !== "")) {
      const existingMessage = tree.getMessage(messageId);
      if (existingMessage) {
        throw new Error(`Message ${messageId} already exists`);
      }
      spec.messageId = messageId;
    }
  }

  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve regenerate's awaited sequencing and rejected-Promise behavior. */
  public regenerate: AbstractChat<
    UIMessage<Metadata, Data, Tools>
  >["regenerate"] = async ({
    messageId,
    ...options
  }: Readonly<{ messageId?: string }> & RequestReader = {}): Promise<void> => {
    const { parentMessageId, target } = this.getRegenerationTarget(messageId);

    if (target.role === "assistant") {
      this.#runs.assertHasCapacity(
        typeof parentMessageId === "string" && parentMessageId !== ""
          ? parentMessageId
          : ROOT_MESSAGE_ID
      );
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
    const run = this.startRunRequest(
      spec,
      async (chat): Promise<void> =>
        await chat.regenerateMessage(target.id, options)
    );
    await run.finished;
  };
  /* oxlint-enable oxc/no-async-await */
  private getRegenerationTarget(messageId?: string): Readonly<{
    parentMessageId: string | null;
    target: UIMessage<Metadata, Data, Tools>;
  }> {
    const { parentMessageId, target } = this.readTree((tree) => {
      const cursorTarget =
        typeof tree.cursorId === "string" && tree.cursorId !== ""
          ? tree.getMessage(tree.cursorId)
          : ABSENT_MESSAGE_TARGET;
      const selectedTarget =
        messageId === ABSENT_MESSAGE_TARGET || messageId === ROOT_MESSAGE_ID
          ? cursorTarget
          : tree.getMessage(messageId);
      let targetParentMessageId: string | null = ROOT_MESSAGE_ID;
      if (selectedTarget) {
        targetParentMessageId =
          selectedTarget.role === "assistant"
            ? (tree.getParentId(selectedTarget.id) ?? ROOT_MESSAGE_ID)
            : selectedTarget.id;
      }
      return { parentMessageId: targetParentMessageId, target: selectedTarget };
    });
    if (!target) {
      throw new Error(`message ${messageId} not found`);
    }
    return { parentMessageId, target };
  }

  public upsertMessage(
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- MessageTree.upsertMessage requires canonical SDK metadata and mutable parts types; the outer message is already readonly.
    message: Readonly<UIMessage<Metadata, Data, Tools>>,
    parentId: string | null
  ): void {
    this.updateTree((tree): void => tree.upsertMessage(message, parentId));
  }

  public removeMessage(messageId: string): void {
    this.updateTree((tree): void => tree.removeLeaf(messageId));
  }

  private updateRunPath(
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- MessageTree.updatePath requires canonical SDK metadata and parts on each message; the containing array is already readonly.
    messages: readonly Readonly<UIMessage<Metadata, Data, Tools>>[]
  ): void {
    this.updateTree((tree): void => tree.updatePath(messages));
  }

  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve resumeStream's awaited sequencing and rejected-Promise behavior. */
  public resumeStream: AbstractChat<
    UIMessage<Metadata, Data, Tools>
  >["resumeStream"] = async (options: RequestReader = {}): Promise<void> => {
    const run =
      this.getSelectedRunRecord() ?? this.createRunForSelectedAssistant();
    if (!run) {
      return;
    }
    await this.resumeRunRequest(run, options);
  };
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve resumeRun's awaited sequencing and rejected-Promise behavior. */
  public resumeRun = async (
    runId: string,
    options: RequestReader = {}
  ): Promise<void> => {
    await this.resumeRunRequest(this.#runs.require(runId), options);
  };
  /* oxlint-enable oxc/no-async-await */
  public restore(
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- MessageTree.restore requires nodes containing canonical SDK messages; the snapshot and node containers are already readonly.
    snapshot: SnapshotInput<Readonly<UIMessage<Metadata, Data, Tools>>>
  ): void {
    this.assertCanResetTree();
    this.#runs.clear();
    this.updateTree((tree): void => tree.restore(snapshot));
  }

  public setMessages(
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- The setter accepts native canonical messages or the SDK updater; deeply readonly messages cannot satisfy MessageTree.setPath.
    messages:
      | readonly Readonly<UIMessage<Metadata, Data, Tools>>[]
      | ((
          // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- The SDK setter updater receives native canonical messages, including mutable metadata and parts; a readonly callback input breaks existing typed updater callers.
          messages: UIMessage<Metadata, Data, Tools>[]
        ) => UIMessage<Metadata, Data, Tools>[])
  ): void {
    const nextMessages =
      typeof messages === "function"
        ? messages(this.getSnapshot().messages)
        : messages;
    this.#runs.select(NO_SELECTED_RUN);
    this.updateTree((tree): void => tree.setPath(nextMessages));
  }

  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve sendMessage's awaited sequencing and rejected-Promise behavior. */
  public sendMessage = async (
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- The installed SDK send input includes canonical parts or FileList; deeply readonly input cannot satisfy message construction and SDK forwarding.
    input?: SendMessageInput<UIMessage<Metadata, Data, Tools>>,
    options?: TreeRequestReader
  ): Promise<void> => {
    const { tree, ...request } = options ?? {};
    if (!input) {
      const cursorId =
        tree && "from" in tree
          ? (tree.from ?? ROOT_MESSAGE_ID)
          : this.getSnapshot().cursorId;
      const cursorMessage =
        typeof cursorId === "string" && cursorId !== ""
          ? this.getMessage(cursorId)
          : ABSENT_MESSAGE_TARGET;
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
      from:
        tree && "from" in tree
          ? (tree.from ?? ROOT_MESSAGE_ID)
          : OMITTED_RUN_ORIGIN,
      message: input,
      request,
    });
    await run.finished;
  };
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve startRun's awaited sequencing and rejected-Promise behavior. */
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- The start input forwards canonical SDK parts and metadata into message construction; a deeply readonly message changes its inferred metadata and fails the SDK input receiver.
  public startRun = async ({
    follow: requestedFollow,
    from,
    message: input,
    request: options,
  }: Readonly<
    Omit<ThreadStartRunOptions<UIMessage<Metadata, Data, Tools>>, "request">
  > & { readonly request?: RequestReader } = {}): Promise<ThreadRunHandle> => {
    const { cursorId, originMessage } = this.getRunOrigin(from);
    const follow = this.resolveFollow(requestedFollow, cursorId);

    if (!input) {
      return this.startRunWithoutMessage(originMessage, follow, options);
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
    this.attachInputMessage(message, cursorId, follow);

    return this.startRunFromParent({
      follow,
      id: this.#runs.reserveId(this.generateMessageId),
      options,
      parentMessageId: message.id,
    });
  };
  /* oxlint-enable oxc/no-async-await */
  private resolveFollow(
    requestedFollow: boolean | undefined,
    cursorId: string | null
  ): boolean {
    const activeCursorId = this.getSnapshot().cursorId;
    return requestedFollow ?? cursorId === activeCursorId;
  }

  private getRunOrigin(from?: string | null): Readonly<{
    cursorId: string | null;
    originMessage: UIMessage<Metadata, Data, Tools> | undefined;
  }> {
    const { cursorId, originMessage } = this.readTree((tree) => {
      const originCursorId = from === OMITTED_RUN_ORIGIN ? tree.cursorId : from;
      return {
        cursorId: originCursorId,
        originMessage:
          typeof originCursorId === "string" && originCursorId !== ""
            ? tree.getMessage(originCursorId)
            : ABSENT_MESSAGE_TARGET,
      };
    });
    if (typeof cursorId === "string" && cursorId !== "" && !originMessage) {
      throw new Error(`Unknown message ${cursorId}`);
    }
    return { cursorId, originMessage };
  }

  private startRunWithoutMessage(
    originMessage: RunParent | undefined,
    follow: boolean,
    options: RequestReader | undefined
  ): ThreadRunHandle {
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

  private attachInputMessage(
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- MessageTree.upsertMessage receives the original SDK message and mutable parts array; recursively readonly parts cannot satisfy its canonical stored-message contract.
    message: Readonly<UIMessage<Metadata, Data, Tools>>,
    cursorId: string | null,
    follow: boolean
  ): void {
    this.updateTree((tree): void => {
      const existingMessage = tree.getMessage(message.id);
      const attachmentId = existingMessage
        ? (tree.getParentId(message.id) ?? ROOT_MESSAGE_ID)
        : cursorId;
      tree.upsertMessage(message, attachmentId);
      if (follow) {
        tree.setCursor(message.id);
      }
    });
  }

  public clearError = (): void => {
    const run = this.getSelectedRunRecord();
    if (run) {
      run.chat.clearError();
    }
  };

  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve stop's awaited sequencing and rejected-Promise behavior. */
  public stop = async (): Promise<void> =>
    await (this.getSelectedRunRecord()?.chat.stop() ?? Promise.resolve());
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve stopAll's awaited sequencing and rejected-Promise behavior. */
  public async stopAll(): Promise<void> {
    await Promise.all(
      this.#runs.getActive().map(
        async (
          run: Readonly<{
            chat: Readonly<
              Pick<ThreadRunChat<UIMessage<Metadata, Data, Tools>>, "stop">
            >;
          }>
        ): Promise<void> => await run.chat.stop()
      )
    );
  }
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve stopRun's awaited sequencing and rejected-Promise behavior. */
  public async stopRun(runId: string): Promise<void> {
    await (this.#runs.get(runId)?.chat.stop() ?? Promise.resolve());
  }
  /* oxlint-enable oxc/no-async-await */
  // oxlint-disable-next-line typescript/promise-function-async -- Forward the overridable public stopRun result: a custom controller may return a shared promise or throw synchronously, both observable through stopRunForMessage.
  public stopRunForMessage(messageId: string): Promise<void> {
    const run = this.getRunForMessage(messageId);
    return run ? this.stopRun(run.id) : Promise.resolve();
  }

  public getRun(runId: string): ThreadRun | undefined {
    const run = this.#runs.get(runId);
    return run ? RunRegistry.toSnapshot(run) : NO_RUN_SNAPSHOT;
  }

  public getRunForMessage(messageId: string): ThreadRun | undefined {
    const run = this.#runs.getForMessage(messageId);
    return run ? RunRegistry.toSnapshot(run) : NO_RUN_SNAPSHOT;
  }

  private setRunError(runId: string, error: Readonly<Error> | undefined): void {
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

  private indexMessageOwnership(
    runId: string,
    message: Parameters<
      RunRegistry<UIMessage<Metadata, Data, Tools>>["indexMessageOwnership"]
    >[typeof SECOND_PARAMETER_INDEX]
  ): void {
    this.#runs.indexMessageOwnership(runId, message);
  }

  private buildSnapshot(
    tree: TreeTransaction<UIMessage<Metadata, Data, Tools>>
  ): ThreadStateSnapshot<UIMessage<Metadata, Data, Tools>> {
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
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- MessageTree construction requires snapshots of canonical SDK messages; the outer snapshot and nodes are readonly.
    snapshot?: SnapshotInput<Readonly<UIMessage<Metadata, Data, Tools>>>
  ): MessageTree<UIMessage<Metadata, Data, Tools>> {
    const resolvedSnapshot = snapshot ?? this.#state.getSnapshot();
    return new MessageTree<UIMessage<Metadata, Data, Tools>>({
      snapshot: resolvedSnapshot,
    });
  }

  #createRunHost(): ThreadRunHost<UIMessage<Metadata, Data, Tools>> {
    return new ThreadRunHostAdapter<UIMessage<Metadata, Data, Tools>>(this, {
      generateMessageId: (): string => this.generateMessageId(),
      getMessagePath: (messageId): UIMessage<Metadata, Data, Tools>[] =>
        this.getMessagePath(messageId),
      registerToolCall: (runId, toolCallId): void =>
        this.registerToolCall(runId, toolCallId),
      removeMessage: (messageId): void => this.removeMessage(messageId),
      setRunError: (runId, error): void => this.setRunError(runId, error),
      setRunStatus: (runId, status): void => this.setRunStatus(runId, status),
      updateRunPath: (
        // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- The host callback forwards canonical SDK messages to MessageTree.updatePath; a deeply readonly parameter also fails the native host callback assignment.
        messages: readonly Readonly<UIMessage<Metadata, Data, Tools>>[]
      ): void => this.updateRunPath(messages),
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- The host callback forwards the canonical SDK response into MessageTree.upsertMessage without changing its parts or metadata types.
      writeRunMessage: (runId, message): void =>
        this.writeRunMessage(runId, message),
    });
  }

  private publish(): void {
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- The state updater supplies snapshots with canonical SDK messages to MessageTree construction; readonly nodes alone do not make native parts readonly.
    this.updateState((snapshot) =>
      this.buildSnapshot(this.createTree(snapshot))
    );
  }

  private readTree<TResult>(
    reader: (tree: TreeTransaction<UIMessage<Metadata, Data, Tools>>) => TResult
  ): TResult {
    return reader(this.createTree());
  }

  private updateTree<TResult>(
    updater: (
      tree: TreeTransaction<UIMessage<Metadata, Data, Tools>>
    ) => TResult
  ): TResult {
    const completed: { value: TResult }[] = [];
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- The state updater supplies snapshots with canonical SDK messages to MessageTree construction; recursively readonly parts fail that receiver.
    this.updateState((snapshot) => {
      const tree = this.createTree(snapshot);
      const value = updater(tree);
      completed.push({ value });
      return this.buildSnapshot(tree);
    });
    const [result] = completed;
    if (completed.length === EMPTY_TRANSACTION_RESULT_COUNT) {
      throw new Error("ThreadState update did not complete");
    }
    return result.value;
  }

  private updateState(
    updater: (
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- The state updater callback receives native canonical snapshots; a deeply readonly snapshot callback fails ThreadState.update assignment.
      snapshot: SnapshotInput<Readonly<UIMessage<Metadata, Data, Tools>>>
    ) => ThreadStateSnapshot<UIMessage<Metadata, Data, Tools>>
  ): void {
    let calls = 0;
    this.#state.update(
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- ThreadState.update supplies native canonical snapshots that are passed to MessageTree construction; outer containers are already readonly.
      (snapshot: SnapshotInput<Readonly<UIMessage<Metadata, Data, Tools>>>) => {
        calls += UPDATE_CALL_INCREMENT;
        return updater(snapshot);
      }
    );
    if (calls !== EXPECTED_UPDATE_CALL_COUNT) {
      throw new Error(
        "ThreadState.update must invoke its updater exactly once and synchronously"
      );
    }
  }

  private assertCanGenerateFrom(parentMessage: RunParent): void {
    ThreadCore.assertValidRunParent(parentMessage);
    this.#runs.assertHasCapacity(parentMessage.id);
  }

  private static assertValidRunParent(message: RunParent): void {
    if (message.role === "assistant") {
      throw new Error(
        `Cannot start a new run directly from assistant message ${message.id}; attach an input message first`
      );
    }
  }

  private getSelectedRunRecord(
    tree: TreeTransaction<UIMessage<Metadata, Data, Tools>> = this.createTree()
  ): RunRecord<UIMessage<Metadata, Data, Tools>> | undefined {
    return this.#runs.resolveSelected({
      cursorId: tree.cursorId,
      pathIds: new Set(tree.getPathIds()),
    });
  }

  private findAssistantOwningPart({
    id,
    label,
    matches,
  }: Readonly<{
    id: string;
    label: string;
    matches: (part: ToolLookupPart) => boolean;
  }>): UIMessage<Metadata, Data, Tools> | undefined {
    let owner: UIMessage<Metadata, Data, Tools> | undefined = NO_PART_OWNER;
    for (const { message } of this.getTreeSnapshot().nodes) {
      if (message.role === "assistant" && message.parts.some(matches)) {
        if (owner && owner.id !== message.id) {
          throw new Error(
            `${label} ${id} appears in more than one assistant message`
          );
        }
        owner = message;
      }
    }
    return owner;
  }

  private getOrCreateRunForApproval(
    approvalId: string
  ): RunRecord<UIMessage<Metadata, Data, Tools>> {
    const existing = this.#runs.findForApproval(approvalId);
    if (existing) {
      return existing;
    }
    const owner = this.findAssistantOwningPart({
      id: approvalId,
      label: "Tool approval",
      matches: (part): boolean =>
        isToolLookupPart(part) && part.approval?.id === approvalId,
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

  private getOrCreateRunForToolCall(
    toolCallId: string
  ): RunRecord<UIMessage<Metadata, Data, Tools>> {
    const existing = this.#runs.findForToolCall(toolCallId);
    if (existing) {
      return existing;
    }
    const owner = this.findAssistantOwningPart({
      id: toolCallId,
      label: "Tool call",
      matches: (part): boolean =>
        isToolLookupPart(part) && part.toolCallId === toolCallId,
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

  private createRunForSelectedAssistant():
    | RunRecord<UIMessage<Metadata, Data, Tools>>
    | undefined {
    const tree = this.createTree();
    const messageId = tree.cursorId;
    if (!(typeof messageId === "string" && messageId !== "")) {
      return NO_ASSISTANT_RUN;
    }
    return this.createRunForAssistant(messageId, true);
  }

  private createRunForAssistant(
    messageId: string,
    select = false
  ): RunRecord<UIMessage<Metadata, Data, Tools>> | undefined {
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
      return NO_ASSISTANT_RUN;
    }
    return this.adoptAssistantRun(tree, message, select);
  }

  private adoptAssistantRun(
    tree: TreeTransaction<UIMessage<Metadata, Data, Tools>>,
    message: Readonly<Pick<UIMessage, "id">> &
      Parameters<
        RunRegistry<UIMessage<Metadata, Data, Tools>>["indexMessageOwnership"]
      >[typeof SECOND_PARAMETER_INDEX],
    select: boolean
  ): RunRecord<UIMessage<Metadata, Data, Tools>> {
    const spec = this.createAssistantRunSpec(tree, message.id);
    const record = this.createReadyRun(spec);
    this.#runs.add(record);
    if (select) {
      this.#runs.select(spec.id);
    }
    this.indexMessageOwnership(spec.id, message);
    this.publish();
    return record;
  }

  private createAssistantRunSpec(
    tree: TreeTransaction<UIMessage<Metadata, Data, Tools>>,
    messageId: string
  ): ThreadRunSpec {
    const parentMessageId = tree.getParentId(messageId) ?? ROOT_MESSAGE_ID;
    const siblingOrder = tree
      .getChildren(parentMessageId)
      .findIndex(
        (child: Readonly<Pick<UIMessage, "id">>): boolean =>
          child.id === messageId
      );
    if (siblingOrder === NOT_FOUND_INDEX) {
      throw new Error(`Message ${messageId} is missing from its sibling order`);
    }

    return {
      id: this.#runs.reserveId(this.generateMessageId),
      initialPathMessageId: messageId,
      messageId,
      parentMessageId,
      siblingOrder,
    };
  }

  private createReadyRun(
    spec: Readonly<ThreadRunSpec>
  ): RunRecord<UIMessage<Metadata, Data, Tools>> {
    return {
      chat: new ThreadRunChat(this.#runHost, spec),
      error: NO_RUN_ERROR,
      finished: Promise.resolve(),
      spec,
      status: "ready",
    };
  }

  private assertCanResetTree(): void {
    if (this.#runs.getActive().length > EMPTY_ACTIVE_RUN_COUNT) {
      throw new Error("Cannot replace the tree while runs are active");
    }
  }

  private startRunFromParent({
    follow,
    id,
    options,
    parentMessageId,
  }: Readonly<
    Omit<
      ThreadRunSpec,
      "initialPathMessageId" | "messageId" | "parentMessageId" | "siblingOrder"
    > & {
      follow: boolean;
      options?: RequestReader;
      parentMessageId: string;
    }
  >): ThreadRunHandle {
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
    /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve callbacks in this return statement's awaited sequencing and rejected-Promise behavior. */
    return this.startRunRequest(
      spec,
      async (chat): Promise<void> => await chat.start(options)
    );
    /* oxlint-enable oxc/no-async-await */
  }

  private startRunRequest(
    spec: Readonly<ThreadRunSpec>,
    start: (
      chat: Readonly<
        Pick<
          ThreadRunChat<UIMessage<Metadata, Data, Tools>>,
          "start" | "startWithMessage" | "regenerateMessage"
        >
      >
    ) => Promise<void>
  ): ThreadRunHandle {
    if (
      typeof spec.parentMessageId === "string" &&
      spec.parentMessageId !== "" &&
      !this.getMessage(spec.parentMessageId)
    ) {
      throw new Error(`Unknown message ${spec.parentMessageId}`);
    }
    const chat = new ThreadRunChat(this.#runHost, spec);
    const record: RunRecord<UIMessage<Metadata, Data, Tools>> = {
      chat,
      error: NO_RUN_ERROR,
      finished: Promise.resolve(),
      spec,
      status: "submitted",
    };
    this.#runs.add(record);
    this.publish();
    const finished = this.publishWhenFinished(start(chat));
    /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve callbacks in this statement's awaited sequencing and rejected-Promise behavior. */
    // Callers can still await detached startRun calls through the finished promise.
    void (async (): Promise<void> => {
      try {
        await finished;
      } catch {
        // The original finished promise retains the rejection for callers.
      }
    })();
    /* oxlint-enable oxc/no-async-await */
    record.finished = finished;
    return this.createRunHandle(record);
  }

  private continueAssistant({
    follow,
    messageId,
    options,
  }: Readonly<{
    follow: boolean;
    messageId: string;
    options?: RequestReader;
  }>): ThreadRunHandle {
    this.assertCanContinueAssistant(messageId);

    const run = this.createRunForAssistant(messageId);
    if (!run) {
      throw new Error(`Message ${messageId} is not an assistant message`);
    }
    if (follow) {
      this.#runs.select(run.spec.id);
      this.updateTree((tree): void => tree.setCursor(messageId));
    }
    run.finished = this.publishWhenFinished(run.chat.start(options));
    this.publish();
    return this.createRunHandle(run);
  }

  private assertCanContinueAssistant(messageId: string): void {
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
      this.#runs.assertHasCapacity(
        tree.getParentId(messageId) ?? ROOT_MESSAGE_ID
      );
    }
  }

  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- The assistant message is passed to the installed SDK startWithMessage receiver; deeply readonly metadata or parts cannot satisfy its send input.
  private startAssistantMessage({
    follow,
    message,
    options,
    parentMessageId,
  }: Readonly<{
    follow: boolean;
    message: Readonly<UIMessage<Metadata, Data, Tools>>;
    options?: RequestReader;
    parentMessageId: string | null;
  }>): ThreadRunHandle {
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
    /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve callbacks in this return statement's awaited sequencing and rejected-Promise behavior. */
    return this.startRunRequest(
      spec,
      async (chat): Promise<void> =>
        await chat.startWithMessage(message, options)
    );
    /* oxlint-enable oxc/no-async-await */
  }

  private createRunHandle(
    run: Readonly<{
      finished: Readonly<Promise<void>>;
      chat: Readonly<
        Pick<ThreadRunChat<UIMessage<Metadata, Data, Tools>>, "stop">
      >;
      spec: Readonly<Pick<ThreadRunSpec, "id">>;
    }>
  ): ThreadRunHandle {
    /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve callbacks in this return statement's awaited sequencing and rejected-Promise behavior. */
    return {
      get finished(): Promise<void> {
        return run.finished;
      },
      getSnapshot: (): ThreadRun | undefined => this.getRun(run.spec.id),
      id: run.spec.id,
      stop: async (): Promise<void> => await run.chat.stop(),
    };
    /* oxlint-enable oxc/no-async-await */
  }

  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve publishWhenFinished's awaited sequencing and rejected-Promise behavior. */
  private async publishWhenFinished<TValue>(
    promise: Readonly<Promise<TValue>>
  ): Promise<TValue> {
    try {
      return await promise;
    } finally {
      this.publish();
    }
  }
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve resumeRunRequest's awaited sequencing and rejected-Promise behavior. */
  private async resumeRunRequest(
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Resuming writes the new completion promise to the existing run record; readonly finished forbids this required live update.
    run: ResumableRun<UIMessage<Metadata, Data, Tools>>,
    options: RequestReader
  ): Promise<void> {
    this.#runs.assertHasCapacity(run.spec.parentMessageId);
    run.chat.refreshPath();
    const finished = this.publishWhenFinished(run.chat.resumeStream(options));
    run.finished = finished;
    this.publish();
    await finished;
  }
  /* oxlint-enable oxc/no-async-await */
}

/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (ThreadCore); the enabled import/no-default-export convention rejects the default-export alternative. */
/* oxlint-disable max-lines -- Keep this cohesive contract and its cases together; splitting it solely for a line quota would obscure shared setup or state transitions. */

export { ThreadCore };
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Keep the named type bindings (ThreadCoreOptions); the enabled import/no-default-export convention rejects the default-export alternative. */
export type { ThreadCoreOptions };
/* oxlint-enable import/no-named-export */
