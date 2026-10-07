import type {
  AbstractChat,
  ChatInit,
  ChatRequestOptions,
  ChatStatus,
  UIMessage,
} from "ai";

type MessageMetadata<TMessage extends UIMessage> =
  TMessage extends UIMessage<infer Metadata, infer _Data, infer _Tools>
    ? Metadata
    : never;
type MessageData<TMessage extends UIMessage> =
  TMessage extends UIMessage<infer _Metadata, infer Data, infer _Tools>
    ? Data
    : never;
type MessageTools<TMessage extends UIMessage> =
  TMessage extends UIMessage<infer _Metadata, infer _Data, infer Tools>
    ? Tools
    : never;

// Thread construction follows the SDK message shape, preserving metadata, data,
// and tools without promising arbitrary extensions the SDK cannot construct.
type CanonicalMessage<TMessage extends UIMessage> = UIMessage<
  MessageMetadata<TMessage>,
  MessageData<TMessage>,
  MessageTools<TMessage>
>;

const FIRST_PARAMETER_INDEX = 0;
const TREE_SNAPSHOT_VERSION = 1;

// Keep exported aliases closed and implicitly assignable to dictionary readers.
// Pick copies the private interface shape without exposing declaration merging.
interface ThreadRunShape {
  error: Error | undefined;
  id: string;
  status: ChatStatus;
}

type ThreadRun = Pick<ThreadRunShape, keyof ThreadRunShape>;

interface ThreadRunHandleShape {
  readonly finished: Promise<void>;
  readonly id: string;
  getSnapshot: () => ThreadRun | undefined;
  stop: () => Promise<void>;
}

type ThreadRunHandle = Pick<ThreadRunHandleShape, keyof ThreadRunHandleShape>;

type TreeSendOptions = ChatRequestOptions & {
  tree?: {
    follow?: boolean;
    from?: string | null;
  };
};

interface ThreadStartRunOptionsShape<TMessage extends UIMessage> {
  follow?: boolean;
  from?: string | null;
  message?: Parameters<
    AbstractChat<TMessage>["sendMessage"]
  >[typeof FIRST_PARAMETER_INDEX];
  request?: ChatRequestOptions;
}

type ThreadStartRunOptions<TMessage extends UIMessage = UIMessage> = Pick<
  ThreadStartRunOptionsShape<TMessage>,
  keyof ThreadStartRunOptionsShape<TMessage>
>;

interface ThreadConcurrencyShape {
  maxActiveRuns?: number;
  maxActiveRunsPerMessage?: number;
}

type ThreadConcurrency = Pick<
  ThreadConcurrencyShape,
  keyof ThreadConcurrencyShape
>;

interface MessageTreeNodeShape<TMessage extends UIMessage> {
  message: TMessage;
  parentId: string | null;
}

type MessageTreeNode<TMessage extends UIMessage = UIMessage> = Pick<
  MessageTreeNodeShape<TMessage>,
  keyof MessageTreeNodeShape<TMessage>
>;

interface MessageTreeSnapshotShape<TMessage extends UIMessage> {
  cursorId: string | null;
  nodes: MessageTreeNode<TMessage>[];
  version: typeof TREE_SNAPSHOT_VERSION;
}

type MessageTreeSnapshot<TMessage extends UIMessage = UIMessage> = Pick<
  MessageTreeSnapshotShape<TMessage>,
  keyof MessageTreeSnapshotShape<TMessage>
>;

type ThreadStateSnapshot<TMessage extends UIMessage = UIMessage> =
  MessageTreeSnapshot<TMessage> & {
    activeRuns: ThreadRun[];
    childrenByParentId: Record<string, string[]>;
    error: Error | undefined;
    messages: TMessage[];
    messagesById: Record<string, TMessage>;
    parentById: Record<string, string | null>;
    rootIds: string[];
    runs: ThreadRun[];
    status: ChatStatus;
    treeStatus: ChatStatus;
  };

interface ThreadState<TMessage extends UIMessage = UIMessage> {
  getSnapshot: () => ThreadStateSnapshot<TMessage>;
  subscribe: (listener: () => void) => () => void;
  /**
   * Applies the updater exactly once and synchronously, commits its returned
   * snapshot before returning, and propagates updater or commit errors.
   */
  update: (
    updater: (
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- The exported updater permits synchronous mutation of its SDK message arrays and returns that same mutable snapshot; readonly collections reject existing updater operations.
      snapshot: ThreadStateSnapshot<TMessage>
    ) => ThreadStateSnapshot<TMessage>
  ) => void;
}

type ThreadInitialState<TMessage extends UIMessage> =
  | { initialTree: MessageTreeSnapshot<TMessage>; messages?: never }
  | { initialTree?: never; messages?: TMessage[] };

type ThreadInit<TMessage extends UIMessage = UIMessage> = Omit<
  ChatInit<CanonicalMessage<TMessage>>,
  "messages"
> & {
  concurrency?: ThreadConcurrency;
} & ThreadInitialState<CanonicalMessage<TMessage>> &
  ThreadInitialState<TMessage>;

/* oxlint-disable import/no-named-export -- Keep the named type bindings (CanonicalMessage, MessageMetadata, MessageData, MessageTools, ThreadRun, ThreadRunHandle, TreeSendOptions, ThreadStartRunOptions, ThreadConcurrency, MessageTreeNode, MessageTreeSnapshot, ThreadStateSnapshot, ThreadState, ThreadInit); the enabled import/no-default-export convention rejects the default-export alternative. */
export type {
  CanonicalMessage,
  MessageMetadata,
  MessageData,
  MessageTools,
  ThreadRun,
  ThreadRunHandle,
  TreeSendOptions,
  ThreadStartRunOptions,
  ThreadConcurrency,
  MessageTreeNode,
  MessageTreeSnapshot,
  ThreadStateSnapshot,
  ThreadState,
  ThreadInit,
};
/* oxlint-enable import/no-named-export */
