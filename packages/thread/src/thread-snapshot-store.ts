import type { UIMessage } from "ai";

import type { AbstractThread } from "./abstract-thread";

const DISABLED_THROTTLE_WAIT_MS = 0;

const ABSENT_VALUE = globalThis.undefined;

type SnapshotSource<TMessage extends UIMessage> = Readonly<
  Pick<AbstractThread<TMessage>, "getSnapshot" | "subscribe">
>;

class SnapshotStore<TMessage extends UIMessage> {
  #snapshot: ReturnType<AbstractThread<TMessage>["getSnapshot"]>;
  public readonly thread: SnapshotSource<TMessage>;
  public readonly throttleWaitMs: number | undefined;

  public readonly getSnapshot = (): ReturnType<
    AbstractThread<TMessage>["getSnapshot"]
  > => this.#snapshot;

  public constructor(
    thread: SnapshotSource<TMessage>,
    throttleWaitMs: number | undefined
  ) {
    this.thread = thread;
    this.throttleWaitMs = throttleWaitMs;
    this.#snapshot = thread.getSnapshot();
  }

  public subscribe = (listener: () => void): (() => void) => {
    this.#snapshot = this.thread.getSnapshot();
    const { throttleWaitMs } = this;
    const publish = (): void => {
      this.#snapshot = this.thread.getSnapshot();
      listener();
    };
    if (
      !(
        throttleWaitMs !== null &&
        throttleWaitMs !== ABSENT_VALUE &&
        throttleWaitMs !== DISABLED_THROTTLE_WAIT_MS &&
        !Number.isNaN(throttleWaitMs)
      )
    ) {
      return this.thread.subscribe(publish);
    }

    let lastCall = 0;
    let timeout: ReturnType<typeof setTimeout> | undefined = ABSENT_VALUE;
    const notify = (): void => {
      const elapsed = Date.now() - lastCall;
      if (elapsed >= throttleWaitMs) {
        lastCall = Date.now();
        publish();
        return;
      }
      if (timeout) {
        return;
      }
      timeout = setTimeout((): void => {
        timeout = ABSENT_VALUE;
        lastCall = Date.now();
        publish();
      }, throttleWaitMs - elapsed);
    };

    const unsubscribe = this.thread.subscribe(notify);
    return (): void => {
      unsubscribe();
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  };
}

export { SnapshotStore };
