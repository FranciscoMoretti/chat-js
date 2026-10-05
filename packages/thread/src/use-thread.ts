import type { UseChatHelpers } from "@ai-sdk/react";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { UIMessage } from "ai";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
/* oxlint-enable sort-imports */

import type { AbstractThread } from "./abstract-thread";
import { Thread } from "./thread";
import type { UseThreadHelpers } from "./thread-hook-helpers";
import { createThreadHelpers } from "./thread-hook-helpers";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { SnapshotStore } from "./thread-snapshot-store";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type {
  CanonicalMessage,
  ThreadInit,
  ThreadStateSnapshot,
} from "./types";
/* oxlint-enable sort-imports */

const FIRST_PARAMETER_INDEX = 0;

// oxlint-disable-next-line eslint/no-undefined -- An absent external controller or owned-controller options uses undefined in React state and optional ThreadInit forwarding; this preserves the existing omitted-value contract.
const OMITTED_HOOK_INPUT = undefined;

// oxlint-disable-next-line eslint/no-undefined -- The supplied-controller guard must exclude exactly undefined; null and other JavaScript values are not the TypeScript optional thread discriminant.
const NO_SUPPLIED_THREAD = undefined;

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

type DispatcherReader<TMessage extends UIMessage> = Readonly<
  Pick<
    LatestThreadDispatchers<TMessage>,
    | "onData"
    | "onError"
    | "onFinish"
    | "onToolCall"
    | "sendAutomaticallyWhen"
    | "update"
  >
>;

const useLatestDispatchers = <TMessage extends UIMessage>(
  callbacks: Readonly<ThreadCallbacks<TMessage>>
): LatestThreadDispatchers<TMessage> => {
  const [dispatchers, setDispatchers] = useState(
    () => new LatestThreadDispatchers(callbacks)
  );
  void setDispatchers;
  return dispatchers;
};

const createOwnedThread = <TMessage extends UIMessage>(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Owned options forward original canonical messages and SDK schema instances into the Thread constructor; deep readonly metadata/schema arrays cannot satisfy that receiving contract.
  ownOptions: Readonly<ThreadInit<TMessage>> | undefined,
  dispatchers: DispatcherReader<TMessage>
): Thread<TMessage> =>
  new Thread<TMessage>({
    ...ownOptions,
    onData: dispatchers.onData,
    onError: dispatchers.onError,
    onFinish: dispatchers.onFinish,
    onToolCall: dispatchers.onToolCall,
    sendAutomaticallyWhen: dispatchers.sendAutomaticallyWhen,
  });

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- React state stores the actual supplied AbstractThread class identity and constructs owned controllers from native SDK schemas/messages; a deep readonly class/schema view fails both state and constructor receivers.
const useSelectedController = <TMessage extends UIMessage>({
  externalThread,
  ownOptions,
  dispatchers,
  callbacks,
}: Readonly<{
  externalThread?: AbstractThread<TMessage>;
  ownOptions?: Readonly<ThreadInit<TMessage>>;
  dispatchers: DispatcherReader<TMessage>;
  callbacks: Readonly<ThreadCallbacks<TMessage>>;
}>): AbstractThread<TMessage> => {
  const [thread, setThread] = useState<AbstractThread<TMessage>>(() => {
    const initialThread =
      externalThread ?? createOwnedThread(ownOptions, dispatchers);
    dispatchers.update(initialThread, callbacks);
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
    setThread(externalThread ?? createOwnedThread(ownOptions, dispatchers));
  }
  return thread;
};

const useDispatcherCallbacks = <TMessage extends UIMessage>(
  thread: Readonly<Pick<AbstractThread<TMessage>, "setMessages">>,
  callbacks: Readonly<ThreadCallbacks<TMessage>>,
  dispatchers: Readonly<Pick<LatestThreadDispatchers<TMessage>, "update">>
): void => {
  useIsomorphicLayoutEffect((): void => {
    dispatchers.update(thread, callbacks);
  }, [
    callbacks.onData,
    callbacks.onError,
    callbacks.onFinish,
    callbacks.onToolCall,
    callbacks.sendAutomaticallyWhen,
    dispatchers,
    thread,
  ]);
};

const useThreadController = <TMessage extends UIMessage>(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Controller selection preserves the supplied AbstractThread identity or forwards native SDK schemas/messages into owned construction; deep readonly options fail those receiving contracts.
  options: Readonly<UseThreadOptions<TMessage>>
): {
  thread: AbstractThread<TMessage>;
  dispatchers: LatestThreadDispatchers<TMessage>;
} => {
  const hasExternalThread = hasSuppliedThread(options);
  const externalThread = hasExternalThread
    ? options.thread
    : OMITTED_HOOK_INPUT;
  const ownOptions = hasExternalThread ? OMITTED_HOOK_INPUT : options;
  const callbacks = {
    onData: ownOptions?.onData,
    onError: ownOptions?.onError,
    onFinish: ownOptions?.onFinish,
    onToolCall: ownOptions?.onToolCall,
    sendAutomaticallyWhen: ownOptions?.sendAutomaticallyWhen,
  };
  const dispatchers = useLatestDispatchers<TMessage>(callbacks);
  const thread = useSelectedController<TMessage>({
    callbacks,
    dispatchers,
    externalThread,
    ownOptions,
  });
  useDispatcherCallbacks(thread, callbacks, dispatchers);
  return { dispatchers, thread };
};

const useThread = <TMessage extends UIMessage = UIMessage>(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- The public hook accepts native SDK construction options or the actual supplied AbstractThread class; forwarding a deep readonly view breaks controller construction and React state identity.
  options: Readonly<UseThreadOptions<TMessage>> = {}
): UseThreadHelpers<TMessage> => {
  const { thread, dispatchers } = useThreadController(options);
  const snapshot = useThreadSnapshot(thread, options.experimental_throttle);
  const status = useThreadField(thread, "status");
  const error = useThreadField(thread, "error");
  const treeStatus = useThreadField(thread, "treeStatus");

  useEffect((): void => {
    if (options.resume === true) {
      void thread.resumeStream();
    }
  }, [options.resume, thread]);

  return createThreadHelpers({
    error,
    setMessages: dispatchers.setMessages,
    snapshot,
    status,
    thread,
    treeStatus,
  });
};

export { useThread };

export type { UseThreadOptions };
export type { TreeHelpers, UseThreadHelpers } from "./thread-hook-helpers";
