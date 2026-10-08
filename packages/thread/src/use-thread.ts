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
  // oxlint-disable-next-line unicorn/prefer-global-this, no-ternary -- #572: This tests for a browser window; globalThis also exists during server rendering.; no-ternary: Keep useIsomorphicLayoutEffect as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
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
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when calling this.#callbacks.onData; preserve one receiver evaluation, skipped call arguments and the undefined short-circuit result.
  ): void => this.#callbacks.onData?.(dataPart);

  public readonly onError = (error: Readonly<Error>): void =>
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when calling this.#callbacks.onError; preserve one receiver evaluation, skipped call arguments and the undefined short-circuit result.
    this.#callbacks.onError?.(error);

  public readonly onFinish = (
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Forward the original canonical SDK message/metadata and mutable messages array into the current user callback; deep readonly changes metadata assignability and array mutation rights.
    event: Readonly<
      Parameters<
        NonNullable<ThreadCallbacks<TMessage>["onFinish"]>
      >[typeof FIRST_PARAMETER_INDEX]
    >
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when calling this.#callbacks.onFinish; preserve one receiver evaluation, skipped call arguments and the undefined short-circuit result.
  ): void => this.#callbacks.onFinish?.(event);

  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve onToolCall's awaited sequencing and rejected-Promise behavior. */
  public readonly onToolCall = async (
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Forward the SDK static/dynamic tool-call union into the current callback; deep readonly generic tool inputs cannot satisfy its original conditional tool specialization.
    event: Readonly<
      Parameters<
        NonNullable<ThreadCallbacks<TMessage>["onToolCall"]>
      >[typeof FIRST_PARAMETER_INDEX]
    >
  ): Promise<void> => {
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when calling this.#callbacks.onToolCall; preserve one receiver evaluation, skipped call arguments and the undefined short-circuit result.
    await this.#callbacks.onToolCall?.(event);
  };
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve sendAutomaticallyWhen's awaited sequencing and rejected-Promise behavior. */
  public readonly sendAutomaticallyWhen = async (
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- The current SDK auto-send callback receives its original mutable message array; readonly array forwarding rejects existing callback implementations.
    event: Readonly<
      Parameters<
        NonNullable<ThreadCallbacks<TMessage>["sendAutomaticallyWhen"]>
      >[typeof FIRST_PARAMETER_INDEX]
    >
  ): Promise<boolean> =>
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when calling this.#callbacks.sendAutomaticallyWhen; preserve one receiver evaluation, skipped call arguments and the existing false fallback.
    await (this.#callbacks.sendAutomaticallyWhen?.(event) ?? false);
  /* oxlint-enable oxc/no-async-await */
  public readonly setMessages = (
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- The SDK setter accepts mutable message arrays and synchronous updater callbacks that may mutate/return their provided array; readonly collections reject that existing updater contract.
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
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Owned options forward original canonical messages and SDK schema instances into the Thread constructor; deep readonly metadata/schema arrays cannot satisfy that receiving contract.
  ownOptions: Readonly<ThreadInit<TMessage>> | undefined,
  dispatchers: DispatcherReader<TMessage>
): Thread<TMessage> =>
  new Thread<TMessage>({
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing ownOptions own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
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
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading id from ownOptions; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
  const [previousThreadId, setPreviousThreadId] = useState(ownOptions?.id);
  if (
    previousExternalThread !== externalThread ||
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading id from ownOptions; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
    previousThreadId !== ownOptions?.id
  ) {
    setPreviousExternalThread(externalThread);
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading id from ownOptions; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
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
  // oxlint-disable-next-line no-ternary -- Keep externalThread as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
  const externalThread = hasExternalThread
    ? options.thread
    : OMITTED_HOOK_INPUT;
  // oxlint-disable-next-line no-ternary -- Keep ownOptions as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
  const ownOptions = hasExternalThread ? OMITTED_HOOK_INPUT : options;
  const callbacks = {
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading onData from ownOptions; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
    onData: ownOptions?.onData,
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading onError from ownOptions; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
    onError: ownOptions?.onError,
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading onFinish from ownOptions; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
    onFinish: ownOptions?.onFinish,
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading onToolCall from ownOptions; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
    onToolCall: ownOptions?.onToolCall,
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading sendAutomaticallyWhen from ownOptions; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
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

/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (useThread); the enabled import/no-default-export convention rejects the default-export alternative. */
export { useThread };
/* oxlint-enable import/no-named-export */

/* oxlint-disable import/no-named-export -- Keep the named type bindings (UseThreadOptions); the enabled import/no-default-export convention rejects the default-export alternative. */
export type { UseThreadOptions };
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Keep the named type bindings (TreeHelpers, UseThreadHelpers); the enabled import/no-default-export convention rejects the default-export alternative. */
export type { TreeHelpers, UseThreadHelpers } from "./thread-hook-helpers";
/* oxlint-enable import/no-named-export */
