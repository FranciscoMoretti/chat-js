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

const FIRST_PARAMETER_INDEX = 0;

const useIsomorphicLayoutEffect =
  // oxlint-disable-next-line unicorn/prefer-global-this -- #572: This tests for a browser window; globalThis also exists during server rendering.
  typeof window === "undefined" ? useEffect : useLayoutEffect;

interface ThreadHookOptions {
  experimental_throttle?: number;
  resume?: boolean;
}

type ThreadCallbacks<TMessage extends UIMessage> = Pick<
  ThreadInit<TMessage>,
  "onData" | "onError" | "onFinish" | "onToolCall" | "sendAutomaticallyWhen"
>;

/* oxlint-disable typescript/prefer-readonly-parameter-types -- The hook forwards ChatInit callbacks and mutable SDK message arrays to Thread and synchronous setMessages updaters; its callback signatures retain the AI SDK generic specialization. */
/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
class LatestThreadDispatchers<TMessage extends UIMessage> {
  #callbacks: ThreadCallbacks<TMessage>;
  #thread: AbstractThread<TMessage> | undefined;

  public constructor(callbacks: ThreadCallbacks<TMessage>) {
    this.#callbacks = callbacks;
  }

  public update(
    thread: AbstractThread<TMessage>,
    callbacks: ThreadCallbacks<TMessage>
  ): void {
    this.#thread = thread;
    this.#callbacks = callbacks;
  }

  public readonly onData = (
    dataPart: Parameters<
      NonNullable<ThreadCallbacks<TMessage>["onData"]>
    >[typeof FIRST_PARAMETER_INDEX]
  ): void => this.#callbacks.onData?.(dataPart);

  public readonly onError = (error: Error): void =>
    this.#callbacks.onError?.(error);

  public readonly onFinish = (
    event: Parameters<
      NonNullable<ThreadCallbacks<TMessage>["onFinish"]>
    >[typeof FIRST_PARAMETER_INDEX]
  ): void => this.#callbacks.onFinish?.(event);

  public readonly onToolCall = (
    event: Parameters<
      NonNullable<ThreadCallbacks<TMessage>["onToolCall"]>
    >[typeof FIRST_PARAMETER_INDEX]
  ): Promise<void> => Promise.resolve(this.#callbacks.onToolCall?.(event));

  public readonly sendAutomaticallyWhen = (
    event: Parameters<
      NonNullable<ThreadCallbacks<TMessage>["sendAutomaticallyWhen"]>
    >[typeof FIRST_PARAMETER_INDEX]
  ): boolean | PromiseLike<boolean> =>
    this.#callbacks.sendAutomaticallyWhen?.(event) ?? false;

  public readonly setMessages: UseChatHelpers<TMessage>["setMessages"] = (
    messages
  ): void => this.#thread?.setMessages(messages);
}
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable typescript/prefer-readonly-parameter-types */

type ExternalThreadOptions<TMessage extends UIMessage> = ThreadHookOptions & {
  thread: AbstractThread<TMessage>;
};

type UseThreadOptions<TMessage extends UIMessage = UIMessage> =
  | ExternalThreadOptions<TMessage>
  | (ThreadHookOptions &
      ThreadInit<TMessage> & {
        thread?: never;
      });

/* oxlint-disable eslint/no-undefined -- Undefined represents an omitted optional argument or absent value in the existing TypeScript/SDK contract. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- The hook forwards ChatInit callbacks and mutable SDK message arrays to Thread and synchronous setMessages updaters; its callback signatures retain the AI SDK generic specialization. */
const hasSuppliedThread = <TMessage extends UIMessage>(
  options: UseThreadOptions<TMessage>
): options is ExternalThreadOptions<TMessage> =>
  "thread" in options && options.thread !== undefined;
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-undefined */

/* oxlint-disable typescript/prefer-readonly-parameter-types -- The hook forwards ChatInit callbacks and mutable SDK message arrays to Thread and synchronous setMessages updaters; its callback signatures retain the AI SDK generic specialization. */
interface TreeHelpersShape<TMessage extends UIMessage> {
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
}
/* oxlint-enable typescript/prefer-readonly-parameter-types */

type TreeHelpers<TMessage extends UIMessage = UIMessage> = Pick<
  TreeHelpersShape<TMessage>,
  keyof TreeHelpersShape<TMessage>
>;

/* oxlint-disable typescript/prefer-readonly-parameter-types -- The hook forwards ChatInit callbacks and mutable SDK message arrays to Thread and synchronous setMessages updaters; its callback signatures retain the AI SDK generic specialization. */
type UseThreadHelpers<TMessage extends UIMessage = UIMessage> =
  UseChatHelpers<TMessage> & {
    sendMessage: (
      message?: Parameters<
        UseChatHelpers<TMessage>["sendMessage"]
      >[typeof FIRST_PARAMETER_INDEX],
      options?: TreeSendOptions
    ) => Promise<void>;
    tree: TreeHelpers<TMessage>;
  };
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-disable typescript/prefer-readonly-parameter-types -- The hook forwards ChatInit callbacks and mutable SDK message arrays to Thread and synchronous setMessages updaters; its callback signatures retain the AI SDK generic specialization. */
const useThreadSnapshot = <TMessage extends UIMessage>(
  thread: AbstractThread<TMessage>,
  throttleWaitMs?: number
): ThreadStateSnapshot<TMessage> => {
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-disable typescript/prefer-readonly-parameter-types -- The hook forwards ChatInit callbacks and mutable SDK message arrays to Thread and synchronous setMessages updaters; its callback signatures retain the AI SDK generic specialization. */
const useThreadField = <
  TMessage extends UIMessage,
  TKey extends keyof ThreadStateSnapshot<TMessage>,
>(
  thread: AbstractThread<TMessage>,
  key: TKey
): ThreadStateSnapshot<TMessage>[TKey] => {
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the ordered validation, state transitions, and cleanup in one operation so their sequencing remains reviewable. */
/* oxlint-disable eslint/no-undefined -- Undefined represents an omitted optional argument or absent value in the existing TypeScript/SDK contract. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- The hook forwards ChatInit callbacks and mutable SDK message arrays to Thread and synchronous setMessages updaters; its callback signatures retain the AI SDK generic specialization. */
/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
const useThread = <TMessage extends UIMessage = UIMessage>(
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

  useIsomorphicLayoutEffect((): void => {
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

  useEffect((): void => {
    if (options.resume === true) {
      void thread.resumeStream();
    }
  }, [options.resume, thread]);

  return {
    addToolApprovalResponse: thread.addToolApprovalResponse,
    addToolOutput: thread.addToolOutput,
    // oxlint-disable-next-line typescript/no-deprecated -- Keep the public AI SDK-compatible helper name until consumers migrate their tool-result calls.
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
      getChildren: (messageId): TMessage[] => thread.getChildren(messageId),
      getLeaves: (messageId): TMessage[] => thread.getLeaves(messageId),
      getMessage: (messageId): TMessage | undefined =>
        thread.getMessage(messageId),
      getParent: (messageId): TMessage | undefined =>
        thread.getParent(messageId),
      getPath: (messageId): TMessage[] => thread.getPath(messageId),
      getRun: (runId): ThreadRun | undefined => thread.getRun(runId),
      getRunForMessage: (messageId): ThreadRun | undefined =>
        thread.getRunForMessage(messageId),
      getSiblings: (messageId): TMessage[] => thread.getSiblings(messageId),
      getSnapshot: (): MessageTreeSnapshot<TMessage> =>
        thread.getTreeSnapshot(),
      messagesById: snapshot.messagesById,
      parentById: snapshot.parentById,
      resumeRun: (runId, requestOptions): Promise<void> =>
        thread.resumeRun(runId, requestOptions),
      rootIds: snapshot.rootIds,
      runs: snapshot.runs,
      setActiveRun: (runId): void => thread.setActiveRun(runId),
      setCursor: (messageId): void => thread.setCursor(messageId),
      setCursorToParentOf: (messageId): void =>
        thread.setCursorToParentOf(messageId),
      startRun: (runOptions): Promise<ThreadRunHandle> =>
        thread.startRun(runOptions),
      status: treeStatus,
      stopAll: (): Promise<void> => thread.stopAll(),
      stopRun: (runId): Promise<void> => thread.stopRun(runId),
      stopRunForMessage: (messageId): Promise<void> =>
        thread.stopRunForMessage(messageId),
    },
  };
};

/* oxlint-disable max-lines -- Keep this cohesive contract and its cases together; splitting it solely for a line quota would obscure shared setup or state transitions. */
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-undefined */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable eslint/max-statements */

export { useThread };

export type { UseThreadOptions, TreeHelpers, UseThreadHelpers };
