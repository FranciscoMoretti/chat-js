import type { UseChatHelpers } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";

import type { AbstractThread } from "./abstract-thread";
import type { RequestReader } from "./ai-sdk-run-chat";
import { Thread } from "./thread";
import { SnapshotStore } from "./thread-snapshot-store";
import type {
  MessageTreeSnapshot,
  CanonicalMessage,
  ThreadInit,
  ThreadRun,
  ThreadRunHandle,
  ThreadStartRunOptions,
  ThreadStateSnapshot,
  TreeSendOptions,
} from "./types";

const FIRST_PARAMETER_INDEX = 0;

// oxlint-disable-next-line eslint/no-undefined -- An absent external controller or owned-controller options uses undefined in React state and optional ThreadInit forwarding; this preserves the existing omitted-value contract.
const OMITTED_HOOK_INPUT = undefined;

// oxlint-disable-next-line eslint/no-undefined -- The supplied-controller guard must exclude exactly undefined; null and other JavaScript values are not the TypeScript optional thread discriminant.
const NO_SUPPLIED_THREAD = undefined;

type TreeRequestReader = RequestReader & {
  readonly tree?: Readonly<NonNullable<TreeSendOptions["tree"]>>;
};

type StartRunReader<TMessage extends UIMessage> = Readonly<
  Omit<ThreadStartRunOptions<CanonicalMessage<TMessage>>, "request">
> & { readonly request?: RequestReader };

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

class LatestThreadDispatchers<TMessage extends UIMessage> {
  #callbacks: Readonly<ThreadCallbacks<TMessage>>;
  #thread: Readonly<Pick<AbstractThread<TMessage>, "setMessages">> | undefined;

  public constructor(callbacks: Readonly<ThreadCallbacks<TMessage>>) {
    this.#callbacks = callbacks;
  }

  public update(
    thread: Readonly<Pick<AbstractThread<TMessage>, "setMessages">>,
    callbacks: Readonly<ThreadCallbacks<TMessage>>
  ): void {
    this.#thread = thread;
    this.#callbacks = callbacks;
  }

  public readonly onData = (
    dataPart: Parameters<
      NonNullable<ThreadCallbacks<TMessage>["onData"]>
    >[typeof FIRST_PARAMETER_INDEX]
  ): void => this.#callbacks.onData?.(dataPart);

  public readonly onError = (error: Readonly<Error>): void =>
    this.#callbacks.onError?.(error);

  public readonly onFinish = (
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Forward the original canonical SDK message/metadata and mutable messages array into the current user callback; deep readonly changes metadata assignability and array mutation rights.
    event: Readonly<
      Parameters<
        NonNullable<ThreadCallbacks<TMessage>["onFinish"]>
      >[typeof FIRST_PARAMETER_INDEX]
    >
  ): void => this.#callbacks.onFinish?.(event);

  public readonly onToolCall = async (
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Forward the SDK static/dynamic tool-call union into the current callback; deep readonly generic tool inputs cannot satisfy its original conditional tool specialization.
    event: Readonly<
      Parameters<
        NonNullable<ThreadCallbacks<TMessage>["onToolCall"]>
      >[typeof FIRST_PARAMETER_INDEX]
    >
  ): Promise<void> => {
    await this.#callbacks.onToolCall?.(event);
  };

  public readonly sendAutomaticallyWhen = async (
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- The current SDK auto-send callback receives its original mutable message array; readonly array forwarding rejects existing callback implementations.
    event: Readonly<
      Parameters<
        NonNullable<ThreadCallbacks<TMessage>["sendAutomaticallyWhen"]>
      >[typeof FIRST_PARAMETER_INDEX]
    >
  ): Promise<boolean> =>
    await (this.#callbacks.sendAutomaticallyWhen?.(event) ?? false);

  public readonly setMessages = (
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- The SDK setter accepts mutable message arrays and synchronous updater callbacks that may mutate/return their provided array; readonly collections reject that existing updater contract.
    messages: Parameters<
      UseChatHelpers<CanonicalMessage<TMessage>>["setMessages"]
    >[typeof FIRST_PARAMETER_INDEX]
  ): void => this.#thread?.setMessages(messages);
}

type ExternalThreadOptions<TMessage extends UIMessage> = ThreadHookOptions & {
  thread: AbstractThread<TMessage>;
};

type UseThreadOptions<TMessage extends UIMessage = UIMessage> =
  | ExternalThreadOptions<TMessage>
  | (ThreadHookOptions &
      ThreadInit<TMessage> & {
        thread?: never;
      });

const hasSuppliedThread = <Options extends Readonly<{ thread?: unknown }>>(
  options: Options
): options is Options & {
  readonly thread: Exclude<Options["thread"], undefined>;
} => "thread" in options && options.thread !== NO_SUPPLIED_THREAD;

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
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- The public start helper accepts canonical SDK input parts and metadata; deeply readonly messages cannot satisfy the supplied controller startRun receiver.
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
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- The public send helper retains the installed SDK input union, including mutable message parts and FileList; a deeply readonly input breaks the native sendMessage assignment.
    message?: Parameters<
      UseChatHelpers<CanonicalMessage<TMessage>>["sendMessage"]
    >[typeof FIRST_PARAMETER_INDEX],
    options?: TreeRequestReader
  ) => Promise<void>;
  tree: TreeHelpers<TMessage>;
};

const useThreadSnapshot = <TMessage extends UIMessage>(
  thread: Readonly<Pick<AbstractThread<TMessage>, "getSnapshot" | "subscribe">>,
  throttleWaitMs?: number
): ThreadStateSnapshot<CanonicalMessage<TMessage>> => {
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
  TKey extends keyof ThreadStateSnapshot<CanonicalMessage<TMessage>>,
>(
  thread: Readonly<Pick<AbstractThread<TMessage>, "getSnapshot" | "subscribe">>,
  key: TKey
): ThreadStateSnapshot<CanonicalMessage<TMessage>>[TKey] => {
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

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the ordered validation, state transitions, and cleanup in one operation so their sequencing remains reviewable. */
const useThread = <TMessage extends UIMessage = UIMessage>(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Owned options forward native SDK schemas, metadata and message arrays into Thread construction, while supplied controllers retain their private class identity; a deeply readonly view breaks both contracts.
  options: Readonly<UseThreadOptions<TMessage>> = {}
): UseThreadHelpers<TMessage> => {
  const hasExternalThread = hasSuppliedThread(options);
  const externalThread = hasExternalThread
    ? options.thread
    : OMITTED_HOOK_INPUT;
  const ownOptions = hasExternalThread ? OMITTED_HOOK_INPUT : options;
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
      // oxlint-disable-next-line typescript/promise-function-async -- A supplied controller may override public resumeRun with a shared promise or synchronous failure; this exposed hook helper forwards that observable contract.
      resumeRun: (runId, requestOptions): Promise<void> =>
        thread.resumeRun(runId, requestOptions),
      rootIds: snapshot.rootIds,
      runs: snapshot.runs,
      setActiveRun: (runId): void => thread.setActiveRun(runId),
      setCursor: (messageId): void => thread.setCursor(messageId),
      setCursorToParentOf: (messageId): void =>
        thread.setCursorToParentOf(messageId),
      // oxlint-disable-next-line typescript/promise-function-async, typescript/prefer-readonly-parameter-types -- Forward the supplied controller startRun override directly to retain its shared promise and synchronous failure; its native SDK input requires canonical metadata/parts, while request and outer options are readonly.
      startRun: (runOptions): Promise<ThreadRunHandle> =>
        thread.startRun(runOptions),
      status: treeStatus,
      // oxlint-disable-next-line typescript/promise-function-async -- Preserve a supplied controller stopAll override result and synchronous failure when exposing the hook helper.
      stopAll: (): Promise<void> => thread.stopAll(),
      // oxlint-disable-next-line typescript/promise-function-async -- The addressed-run helper forwards the supplied controller public stopRun override promise and synchronous failure.
      stopRun: (runId): Promise<void> => thread.stopRun(runId),
      // oxlint-disable-next-line typescript/promise-function-async -- The per-message helper forwards the supplied controller override promise and synchronous failure without async adoption.
      stopRunForMessage: (messageId): Promise<void> =>
        thread.stopRunForMessage(messageId),
    },
  };
};

/* oxlint-disable max-lines -- Keep this cohesive contract and its cases together; splitting it solely for a line quota would obscure shared setup or state transitions. */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable eslint/max-statements */

export { useThread };

export type { UseThreadOptions, TreeHelpers, UseThreadHelpers };
