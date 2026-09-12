import type { UseChatHelpers } from "@ai-sdk/react";
import type { ChatRequestOptions, UIMessage } from "ai";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";

import type { AbstractThread } from "./abstract-thread";
import { Thread } from "./thread";
import { SnapshotStore } from "./thread-snapshot-store";
import type {
  MessageTreeSnapshot,
  ThreadInit,
  ThreadRun,
  ThreadRunHandle,
  ThreadStartRunOptions,
  ThreadStateSnapshot,
  TreeSendOptions,
} from "./types";

const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

type ThreadHookOptions = {
  experimental_throttle?: number;
  resume?: boolean;
};

type ThreadCallbacks<TMessage extends UIMessage> = Pick<
  ThreadInit<TMessage>,
  "onData" | "onError" | "onFinish" | "onToolCall" | "sendAutomaticallyWhen"
>;

class LatestThreadDispatchers<TMessage extends UIMessage> {
  #callbacks: ThreadCallbacks<TMessage>;
  #thread: AbstractThread<TMessage> | undefined;

  constructor(callbacks: ThreadCallbacks<TMessage>) {
    this.#callbacks = callbacks;
  }

  update(
    thread: AbstractThread<TMessage>,
    callbacks: ThreadCallbacks<TMessage>
  ) {
    this.#thread = thread;
    this.#callbacks = callbacks;
  }

  readonly onData = (
    dataPart: Parameters<NonNullable<ThreadCallbacks<TMessage>["onData"]>>[0]
  ) => this.#callbacks.onData?.(dataPart);

  readonly onError = (error: Error) => this.#callbacks.onError?.(error);

  readonly onFinish = (
    event: Parameters<NonNullable<ThreadCallbacks<TMessage>["onFinish"]>>[0]
  ) => this.#callbacks.onFinish?.(event);

  readonly onToolCall = (
    event: Parameters<NonNullable<ThreadCallbacks<TMessage>["onToolCall"]>>[0]
  ) => Promise.resolve(this.#callbacks.onToolCall?.(event));

  readonly sendAutomaticallyWhen = (
    event: Parameters<
      NonNullable<ThreadCallbacks<TMessage>["sendAutomaticallyWhen"]>
    >[0]
  ) => this.#callbacks.sendAutomaticallyWhen?.(event) ?? false;

  readonly setMessages: UseChatHelpers<TMessage>["setMessages"] = (messages) =>
    this.#thread?.setMessages(messages);
}

type ExternalThreadOptions<TMessage extends UIMessage> = ThreadHookOptions & {
  thread: AbstractThread<TMessage>;
};

export type UseThreadOptions<TMessage extends UIMessage = UIMessage> =
  | ExternalThreadOptions<TMessage>
  | (ThreadHookOptions &
      ThreadInit<TMessage> & {
        thread?: never;
      });

const hasSuppliedThread = <TMessage extends UIMessage>(
  options: UseThreadOptions<TMessage>
): options is ExternalThreadOptions<TMessage> =>
  "thread" in options && options.thread !== undefined;

export type TreeHelpers<TMessage extends UIMessage = UIMessage> = {
  activeRuns: ThreadRun[];
  childrenByParentId: Record<string, string[]>;
  cursorId: string | null;
  getChildren: (messageId: string | null) => TMessage[];
  getLeaves: (messageId?: string | null) => TMessage[];
  getMessage: (messageId: string) => TMessage | undefined;
  getParent: (messageId: string) => TMessage | undefined;
  getPath: (messageId?: string | null) => TMessage[];
  getRun: (runId: string) => ThreadRun | undefined;
  getRunForMessage: (messageId: string) => ThreadRun | undefined;
  getSiblings: (messageId: string) => TMessage[];
  getSnapshot: () => MessageTreeSnapshot<TMessage>;
  messagesById: Record<string, TMessage>;
  parentById: Record<string, string | null>;
  resumeRun: (runId: string, options?: ChatRequestOptions) => Promise<void>;
  rootIds: string[];
  runs: ThreadRun[];
  setActiveRun: (runId: string) => void;
  setCursor: (messageId: string | null) => void;
  setCursorToParentOf: (messageId: string) => void;
  startRun: (
    options?: ThreadStartRunOptions<TMessage>
  ) => Promise<ThreadRunHandle>;
  status: ReturnType<AbstractThread<TMessage>["getSnapshot"]>["treeStatus"];
  stopAll: () => Promise<void>;
  stopRun: (runId: string) => Promise<void>;
  stopRunForMessage: (messageId: string) => Promise<void>;
};

export type UseThreadHelpers<TMessage extends UIMessage = UIMessage> =
  UseChatHelpers<TMessage> & {
    sendMessage: (
      message?: Parameters<UseChatHelpers<TMessage>["sendMessage"]>[0],
      options?: TreeSendOptions
    ) => Promise<void>;
    tree: TreeHelpers<TMessage>;
  };

const useThreadSnapshot = <TMessage extends UIMessage>(
  thread: AbstractThread<TMessage>,
  throttleWaitMs?: number
) => {
  const store = useMemo(
    () => new SnapshotStore(thread, throttleWaitMs),
    [thread, throttleWaitMs]
  );

  return useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot
  );
};

const useThreadField = <
  TMessage extends UIMessage,
  TKey extends keyof ThreadStateSnapshot<TMessage>,
>(
  thread: AbstractThread<TMessage>,
  key: TKey
) => {
  const subscribe = useCallback(
    (listener: () => void) => thread.subscribe(listener),
    [thread]
  );
  const getSnapshot = useCallback(
    () => thread.getSnapshot()[key],
    [thread, key]
  );
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
};

export const useThread = <TMessage extends UIMessage = UIMessage>(
  options: UseThreadOptions<TMessage> = {}
): UseThreadHelpers<TMessage> => {
  const hasExternalThread = hasSuppliedThread(options);
  const externalThread = hasExternalThread ? options.thread : undefined;
  const ownOptions = hasExternalThread ? undefined : options;
  const onData = ownOptions?.onData;
  const onError = ownOptions?.onError;
  const onFinish = ownOptions?.onFinish;
  const onToolCall = ownOptions?.onToolCall;
  const sendAutomaticallyWhen = ownOptions?.sendAutomaticallyWhen;
  const [dispatchers, setDispatchers] = useState(
    () =>
      new LatestThreadDispatchers({
        onData,
        onError,
        onFinish,
        onToolCall,
        sendAutomaticallyWhen,
      })
  );
  void setDispatchers;
  const [thread, setThread] = useState<AbstractThread<TMessage>>(() => {
    const initialThread =
      externalThread ??
      new Thread({
        ...ownOptions,
        onData: dispatchers.onData,
        onError: dispatchers.onError,
        onFinish: dispatchers.onFinish,
        onToolCall: dispatchers.onToolCall,
        sendAutomaticallyWhen: dispatchers.sendAutomaticallyWhen,
      });
    dispatchers.update(initialThread, {
      onData,
      onError,
      onFinish,
      onToolCall,
      sendAutomaticallyWhen,
    });
    return initialThread;
  });
  const [previousExternalThread, setPreviousExternalThread] =
    useState(externalThread);
  const [previousThreadId, setPreviousThreadId] = useState(ownOptions?.id);

  if (
    previousExternalThread !== externalThread ||
    previousThreadId !== ownOptions?.id
  ) {
    setPreviousExternalThread(externalThread);
    setPreviousThreadId(ownOptions?.id);
    setThread(
      externalThread ??
        new Thread({
          ...ownOptions,
          onData: dispatchers.onData,
          onError: dispatchers.onError,
          onFinish: dispatchers.onFinish,
          onToolCall: dispatchers.onToolCall,
          sendAutomaticallyWhen: dispatchers.sendAutomaticallyWhen,
        })
    );
  }

  useIsomorphicLayoutEffect(() => {
    dispatchers.update(thread, {
      onData,
      onError,
      onFinish,
      onToolCall,
      sendAutomaticallyWhen,
    });
  }, [
    dispatchers,
    onData,
    onError,
    onFinish,
    onToolCall,
    sendAutomaticallyWhen,
    thread,
  ]);

  const snapshot = useThreadSnapshot(thread, options.experimental_throttle);
  const status = useThreadField(thread, "status");
  const error = useThreadField(thread, "error");
  const treeStatus = useThreadField(thread, "treeStatus");

  useEffect(() => {
    if (options.resume) {
      thread.resumeStream();
    }
  }, [options.resume, thread]);

  return {
    addToolApprovalResponse: thread.addToolApprovalResponse,
    addToolOutput: thread.addToolOutput,
    addToolResult: thread.addToolResult,
    clearError: thread.clearError,
    error,
    id: thread.id,
    messages: snapshot.messages,
    regenerate: thread.regenerate,
    resumeStream: thread.resumeStream,
    sendMessage: thread.sendMessage,
    setMessages: dispatchers.setMessages,
    status,
    stop: thread.stop,
    tree: {
      activeRuns: snapshot.activeRuns,
      childrenByParentId: snapshot.childrenByParentId,
      cursorId: snapshot.cursorId,
      getChildren: (messageId) => thread.getChildren(messageId),
      getLeaves: (messageId) => thread.getLeaves(messageId),
      getMessage: (messageId) => thread.getMessage(messageId),
      getParent: (messageId) => thread.getParent(messageId),
      getPath: (messageId) => thread.getPath(messageId),
      getRun: (runId) => thread.getRun(runId),
      getRunForMessage: (messageId) => thread.getRunForMessage(messageId),
      getSiblings: (messageId) => thread.getSiblings(messageId),
      getSnapshot: () => thread.getTreeSnapshot(),
      messagesById: snapshot.messagesById,
      parentById: snapshot.parentById,
      resumeRun: (runId, requestOptions) =>
        thread.resumeRun(runId, requestOptions),
      rootIds: snapshot.rootIds,
      runs: snapshot.runs,
      setActiveRun: (runId) => thread.setActiveRun(runId),
      setCursor: (messageId) => thread.setCursor(messageId),
      setCursorToParentOf: (messageId) => thread.setCursorToParentOf(messageId),
      startRun: (runOptions) => thread.startRun(runOptions),
      status: treeStatus,
      stopAll: () => thread.stopAll(),
      stopRun: (runId) => thread.stopRun(runId),
      stopRunForMessage: (messageId) => thread.stopRunForMessage(messageId),
    },
  };
};
