import type {
  AbstractChat,
  ChatInit,
  ChatRequestOptions,
  ChatStatus,
  UIMessage,
} from "ai";

/* oxlint-disable import/exports-last -- Keep the exported declaration beside the types and initialization it describes; moving it can reorder module initialization. */
/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
/* oxlint-disable typescript/consistent-type-definitions -- Keep this structural alias closed to declaration merging and compatible with the existing generic/record API. */
export type ThreadRun = {
  error: Error | undefined;
  id: string;
  status: ChatStatus;
};
/* oxlint-enable typescript/consistent-type-definitions */
/* oxlint-enable import/group-exports */
/* oxlint-enable import/exports-last */

/* oxlint-disable import/exports-last -- Keep the exported declaration beside the types and initialization it describes; moving it can reorder module initialization. */
/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
/* oxlint-disable typescript/consistent-type-definitions -- Keep this structural alias closed to declaration merging and compatible with the existing generic/record API. */
export type ThreadRunHandle = {
  readonly finished: Promise<void>;
  readonly id: string;
  getSnapshot: () => ThreadRun | undefined;
  stop: () => Promise<void>;
};
/* oxlint-enable typescript/consistent-type-definitions */
/* oxlint-enable import/group-exports */
/* oxlint-enable import/exports-last */

/* oxlint-disable import/exports-last -- Keep the exported declaration beside the types and initialization it describes; moving it can reorder module initialization. */
/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
export type TreeSendOptions = ChatRequestOptions & {
  tree?: {
    follow?: boolean;
    from?: string | null;
  };
};
/* oxlint-enable import/group-exports */
/* oxlint-enable import/exports-last */

/* oxlint-disable import/exports-last -- Keep the exported declaration beside the types and initialization it describes; moving it can reorder module initialization. */
/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
/* oxlint-disable typescript/consistent-type-definitions -- Keep this structural alias closed to declaration merging and compatible with the existing generic/record API. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
export type ThreadStartRunOptions<TMessage extends UIMessage = UIMessage> = {
  follow?: boolean;
  from?: string | null;
  message?: Parameters<AbstractChat<TMessage>["sendMessage"]>[0];
  request?: ChatRequestOptions;
};
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable typescript/consistent-type-definitions */
/* oxlint-enable import/group-exports */
/* oxlint-enable import/exports-last */

/* oxlint-disable import/exports-last -- Keep the exported declaration beside the types and initialization it describes; moving it can reorder module initialization. */
/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
/* oxlint-disable typescript/consistent-type-definitions -- Keep this structural alias closed to declaration merging and compatible with the existing generic/record API. */
export type ThreadConcurrency = {
  maxActiveRuns?: number;
  maxActiveRunsPerMessage?: number;
};
/* oxlint-enable typescript/consistent-type-definitions */
/* oxlint-enable import/group-exports */
/* oxlint-enable import/exports-last */

/* oxlint-disable import/exports-last -- Keep the exported declaration beside the types and initialization it describes; moving it can reorder module initialization. */
/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
/* oxlint-disable typescript/consistent-type-definitions -- Keep this structural alias closed to declaration merging and compatible with the existing generic/record API. */
export type MessageTreeNode<TMessage extends UIMessage = UIMessage> = {
  message: TMessage;
  parentId: string | null;
};
/* oxlint-enable typescript/consistent-type-definitions */
/* oxlint-enable import/group-exports */
/* oxlint-enable import/exports-last */

/* oxlint-disable import/exports-last -- Keep the exported declaration beside the types and initialization it describes; moving it can reorder module initialization. */
/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
/* oxlint-disable typescript/consistent-type-definitions -- Keep this structural alias closed to declaration merging and compatible with the existing generic/record API. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
export type MessageTreeSnapshot<TMessage extends UIMessage = UIMessage> = {
  cursorId: string | null;
  nodes: MessageTreeNode<TMessage>[];
  version: 1;
};
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable typescript/consistent-type-definitions */
/* oxlint-enable import/group-exports */
/* oxlint-enable import/exports-last */

/* oxlint-disable import/exports-last -- Keep the exported declaration beside the types and initialization it describes; moving it can reorder module initialization. */
/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
export type ThreadStateSnapshot<TMessage extends UIMessage = UIMessage> =
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
/* oxlint-enable import/group-exports */
/* oxlint-enable import/exports-last */

/* oxlint-disable import/exports-last -- Keep the exported declaration beside the types and initialization it describes; moving it can reorder module initialization. */
/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
export interface ThreadState<TMessage extends UIMessage = UIMessage> {
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
/* oxlint-enable import/group-exports */
/* oxlint-enable import/exports-last */

type ThreadInitialState<TMessage extends UIMessage> =
  | { initialTree: MessageTreeSnapshot<TMessage>; messages?: never }
  | { initialTree?: never; messages?: TMessage[] };

/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
export type ThreadInit<TMessage extends UIMessage = UIMessage> = Omit<
  ChatInit<TMessage>,
  "messages"
> & {
  concurrency?: ThreadConcurrency;
} & ThreadInitialState<TMessage>;
/* oxlint-enable import/group-exports */
