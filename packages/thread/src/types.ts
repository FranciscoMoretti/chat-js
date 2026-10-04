import type {
  AbstractChat,
  ChatInit,
  ChatRequestOptions,
  ChatStatus,
  UIMessage,
} from "ai";

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

/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
interface ThreadState<TMessage extends UIMessage = UIMessage> {
  getSnapshot: () => ThreadStateSnapshot<TMessage>;
  subscribe: (listener: () => void) => () => void;
  /**
   * Applies the updater exactly once and synchronously, commits its returned
   * snapshot before returning, and propagates updater or commit errors.
   */
  update: (
    updater: (
      snapshot: ThreadStateSnapshot<TMessage>
    ) => ThreadStateSnapshot<TMessage>
  ) => void;
}
/* oxlint-enable typescript/prefer-readonly-parameter-types */

type ThreadInitialState<TMessage extends UIMessage> =
  | { initialTree: MessageTreeSnapshot<TMessage>; messages?: never }
  | { initialTree?: never; messages?: TMessage[] };

type ThreadInit<TMessage extends UIMessage = UIMessage> = Omit<
  ChatInit<TMessage>,
  "messages"
> & {
  concurrency?: ThreadConcurrency;
} & ThreadInitialState<TMessage>;

export type {
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
