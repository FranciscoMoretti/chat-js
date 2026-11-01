import type {
  CanonicalMessage,
  ThreadInit,
  ThreadStateSnapshot,
} from "./types";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import type { AbstractThread } from "./abstract-thread";
import { SnapshotStore } from "./thread-snapshot-store";
import { Thread } from "./thread";
import type { UIMessage } from "ai";
import type { UseChatHelpers } from "@ai-sdk/react";
import type { UseThreadHelpers } from "./thread-hook-helpers";
import { createThreadHelpers } from "./thread-hook-helpers";

const FIRST_PARAMETER_INDEX = 0;

// An absent external controller or owned-controller options uses undefined in React state and optional ThreadInit forwarding; this preserves the existing omitted-value contract.
const OMITTED_HOOK_INPUT = globalThis.undefined;

// The supplied-controller guard must exclude exactly undefined; null and other JavaScript values are not the TypeScript optional thread discriminant.
const NO_SUPPLIED_THREAD = globalThis.undefined;

const useIsomorphicLayoutEffect =
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
    event: Readonly<
      Parameters<
        NonNullable<ThreadCallbacks<TMessage>["onFinish"]>
      >[typeof FIRST_PARAMETER_INDEX]
    >
  ): void => this.#callbacks.onFinish?.(event);

  public readonly onToolCall = async (
    event: Readonly<
      Parameters<
        NonNullable<ThreadCallbacks<TMessage>["onToolCall"]>
      >[typeof FIRST_PARAMETER_INDEX]
    >
  ): Promise<void> => {
    await this.#callbacks.onToolCall?.(event);
  };
  public readonly sendAutomaticallyWhen = async (
    event: Readonly<
      Parameters<
        NonNullable<ThreadCallbacks<TMessage>["sendAutomaticallyWhen"]>
      >[typeof FIRST_PARAMETER_INDEX]
    >
  ): Promise<boolean> =>
    await (this.#callbacks.sendAutomaticallyWhen?.(event) ?? false);
  public readonly setMessages = (
    messages: Parameters<
      UseChatHelpers<CanonicalMessage<TMessage>>["setMessages"]
    >[typeof FIRST_PARAMETER_INDEX]
  ): void => {
    if (this.#thread) {
      this.#thread.setMessages(messages);
    }
  };
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
  const [previousThreadId, setPreviousThreadId] = useState(
    ownOptions && ownOptions.id
  );
  if (
    previousExternalThread !== externalThread ||
    previousThreadId !== (ownOptions && ownOptions.id)
  ) {
    setPreviousExternalThread(externalThread);
    setPreviousThreadId(ownOptions && ownOptions.id);
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
    onData: ownOptions && ownOptions.onData,
    onError: ownOptions && ownOptions.onError,
    onFinish: ownOptions && ownOptions.onFinish,
    onToolCall: ownOptions && ownOptions.onToolCall,
    sendAutomaticallyWhen: ownOptions && ownOptions.sendAutomaticallyWhen,
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
