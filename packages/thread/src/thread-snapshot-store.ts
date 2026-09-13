import type { UIMessage } from "ai";

import type { AbstractThread } from "./abstract-thread";

export class SnapshotStore<TMessage extends UIMessage> {
  #snapshot: ReturnType<AbstractThread<TMessage>["getSnapshot"]>;
  readonly thread: AbstractThread<TMessage>;
  readonly throttleWaitMs: number | undefined;

  readonly getSnapshot = () => this.#snapshot;

  constructor(
    thread: AbstractThread<TMessage>,
    throttleWaitMs: number | undefined
  ) {
    this.thread = thread;
    this.throttleWaitMs = throttleWaitMs;
    this.#snapshot = thread.getSnapshot();
  }

  subscribe = (listener: () => void) => {
    this.#snapshot = this.thread.getSnapshot();
    const { throttleWaitMs } = this;
    const publish = () => {
      this.#snapshot = this.thread.getSnapshot();
      listener();
    };
    if (!throttleWaitMs) {
      return this.thread.subscribe(publish);
    }

    let lastCall = 0;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const notify = () => {
      const elapsed = Date.now() - lastCall;
      if (elapsed >= throttleWaitMs) {
        lastCall = Date.now();
        publish();
        return;
      }
      if (timeout) {
        return;
      }
      timeout = setTimeout(() => {
        timeout = undefined;
        lastCall = Date.now();
        publish();
      }, throttleWaitMs - elapsed);
    };

    const unsubscribe = this.thread.subscribe(notify);
    return () => {
      unsubscribe();
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  };
}
