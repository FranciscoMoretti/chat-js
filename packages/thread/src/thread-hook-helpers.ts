import type {
  CanonicalMessage,
  MessageTreeSnapshot,
  ThreadRun,
  ThreadRunHandle,
  ThreadStartRunOptions,
  ThreadStateSnapshot,
  TreeSendOptions,
} from "./types";
import type { ChatStatus, UIMessage } from "ai";
import type { AbstractThread } from "./abstract-thread";
import type { RequestReader } from "./ai-sdk-run-chat";
import type { UseChatHelpers } from "@ai-sdk/react";

const FIRST_PARAMETER_INDEX = 0;

type TreeRequestReader = RequestReader & {
  readonly tree?: Readonly<NonNullable<TreeSendOptions["tree"]>>;
};

type StartRunReader<TMessage extends UIMessage> = Readonly<
  Omit<ThreadStartRunOptions<CanonicalMessage<TMessage>>, "request">
> & { readonly request?: RequestReader };

interface TreeHelpersShape<TMessage extends UIMessage> {
  activeRuns: ThreadRun[];
  childrenByParentId: Record<string, string[]>;
  cursorId: string | null;
  getChildren: (messageId: string | null) => CanonicalMessage<TMessage>[];
  getLeaves: (messageId?: string | null) => CanonicalMessage<TMessage>[];
  getMessage: (messageId: string) => CanonicalMessage<TMessage> | undefined;
  getParent: (messageId: string) => CanonicalMessage<TMessage> | undefined;
  getPath: (messageId?: string | null) => CanonicalMessage<TMessage>[];
  getRun: (runId: string) => ThreadRun | undefined;
  getRunForMessage: (messageId: string) => ThreadRun | undefined;
  getSiblings: (messageId: string) => CanonicalMessage<TMessage>[];
  getSnapshot: () => MessageTreeSnapshot<CanonicalMessage<TMessage>>;
  messagesById: Record<string, CanonicalMessage<TMessage>>;
  parentById: Record<string, string | null>;
  resumeRun: (runId: string, options?: RequestReader) => Promise<void>;
  rootIds: string[];
  runs: ThreadRun[];
  setActiveRun: (runId: string) => void;
  setCursor: (messageId: string | null) => void;
  setCursorToParentOf: (messageId: string) => void;
  startRun: (options?: StartRunReader<TMessage>) => Promise<ThreadRunHandle>;
  status: ReturnType<AbstractThread<TMessage>["getSnapshot"]>["treeStatus"];
  stopAll: () => Promise<void>;
  stopRun: (runId: string) => Promise<void>;
  stopRunForMessage: (messageId: string) => Promise<void>;
}

type TreeHelpers<TMessage extends UIMessage = UIMessage> = Pick<
  TreeHelpersShape<TMessage>,
  keyof TreeHelpersShape<TMessage>
>;

type UseThreadHelpers<TMessage extends UIMessage = UIMessage> = UseChatHelpers<
  CanonicalMessage<TMessage>
> & {
  sendMessage: (
    message?: Parameters<
      UseChatHelpers<CanonicalMessage<TMessage>>["sendMessage"]
    >[typeof FIRST_PARAMETER_INDEX],
    options?: TreeRequestReader
  ) => Promise<void>;
  tree: TreeHelpers<TMessage>;
};

type TreeControllerReader<TMessage extends UIMessage> = Readonly<
  Pick<
    AbstractThread<TMessage>,
    | "getChildren"
    | "getLeaves"
    | "getMessage"
    | "getParent"
    | "getPath"
    | "getRun"
    | "getRunForMessage"
    | "getSiblings"
    | "getTreeSnapshot"
    | "resumeRun"
    | "setActiveRun"
    | "setCursor"
    | "setCursorToParentOf"
    | "startRun"
    | "stopAll"
    | "stopRun"
    | "stopRunForMessage"
  >
>;

type HelperControllerReader<TMessage extends UIMessage> =
  TreeControllerReader<TMessage> &
    Readonly<
      Pick<
        AbstractThread<TMessage>,
        | "id"
        | "addToolApprovalResponse"
        | "addToolOutput"
        | "addToolResult"
        | "clearError"
        | "regenerate"
        | "resumeStream"
        | "sendMessage"
        | "stop"
      >
    >;

const createTreeHelpers = <TMessage extends UIMessage>({
  thread,
  snapshot,
  status: treeStatus,
}: Readonly<{
  thread: TreeControllerReader<TMessage>;
  snapshot: Readonly<ThreadStateSnapshot<CanonicalMessage<TMessage>>>;
  status: ChatStatus;
}>): TreeHelpers<TMessage> => ({
  activeRuns: snapshot.activeRuns,
  childrenByParentId: snapshot.childrenByParentId,
  cursorId: snapshot.cursorId,
  getChildren: (messageId): CanonicalMessage<TMessage>[] =>
    thread.getChildren(messageId),
  getLeaves: (messageId): CanonicalMessage<TMessage>[] =>
    thread.getLeaves(messageId),
  getMessage: (messageId): CanonicalMessage<TMessage> | undefined =>
    thread.getMessage(messageId),
  getParent: (messageId): CanonicalMessage<TMessage> | undefined =>
    thread.getParent(messageId),
  getPath: (messageId): CanonicalMessage<TMessage>[] =>
    thread.getPath(messageId),
  getRun: (runId): ThreadRun | undefined => thread.getRun(runId),
  getRunForMessage: (messageId): ThreadRun | undefined =>
    thread.getRunForMessage(messageId),
  getSiblings: (messageId): CanonicalMessage<TMessage>[] =>
    thread.getSiblings(messageId),
  getSnapshot: (): MessageTreeSnapshot<CanonicalMessage<TMessage>> =>
    thread.getTreeSnapshot(),
  messagesById: snapshot.messagesById,
  parentById: snapshot.parentById,
  resumeRun: async (runId, requestOptions): Promise<void> => {
    await thread.resumeRun(runId, requestOptions);
  },
  rootIds: snapshot.rootIds,
  runs: snapshot.runs,
  setActiveRun: (runId): void => {
    thread.setActiveRun(runId);
  },
  setCursor: (messageId): void => {
    thread.setCursor(messageId);
  },
  setCursorToParentOf: (messageId): void => {
    thread.setCursorToParentOf(messageId);
  },
  startRun: async (runOptions): Promise<ThreadRunHandle> =>
    await thread.startRun(runOptions),
  status: treeStatus,
  stopAll: async (): Promise<void> => {
    await thread.stopAll();
  },
  stopRun: async (runId): Promise<void> => {
    await thread.stopRun(runId);
  },
  stopRunForMessage: async (messageId): Promise<void> => {
    await thread.stopRunForMessage(messageId);
  },
});

const createThreadHelpers = <TMessage extends UIMessage>({
  thread,
  setMessages,
  snapshot,
  status,
  error,
  treeStatus,
}: Readonly<{
  thread: HelperControllerReader<TMessage>;
  setMessages: UseChatHelpers<CanonicalMessage<TMessage>>["setMessages"];
  snapshot: Readonly<ThreadStateSnapshot<CanonicalMessage<TMessage>>>;
  status: ChatStatus;
  error: Readonly<Error> | undefined;
  treeStatus: ChatStatus;
}>): UseThreadHelpers<TMessage> => ({
  addToolApprovalResponse: thread.addToolApprovalResponse,
  addToolOutput: thread.addToolOutput,
  // oxlint-disable-next-line typescript/no-deprecated -- Forward the public legacy helper itself: callers can override addToolResult independently of addToolOutput, so redirecting this property would change that compatibility contract.
  addToolResult: thread.addToolResult,
  clearError: thread.clearError,
  error,
  id: thread.id,
  messages: snapshot.messages,
  regenerate: thread.regenerate,
  resumeStream: thread.resumeStream,
  sendMessage: thread.sendMessage,
  setMessages,
  status,
  stop: thread.stop,
  tree: createTreeHelpers({ snapshot, status: treeStatus, thread }),
});

export { createThreadHelpers };
export type { TreeHelpers, UseThreadHelpers };
