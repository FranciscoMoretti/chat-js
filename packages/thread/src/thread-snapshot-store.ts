import type { UIMessage } from "ai";

import type { AbstractThread } from "./abstract-thread";

/* oxlint-disable eslint/no-undefined -- Undefined represents an omitted optional argument or absent value in the existing TypeScript/SDK contract. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/* oxlint-disable eslint/init-declarations -- The value is assigned by the following guarded operation; an invented initial value would hide an uninitialized control-flow branch. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- SnapshotStore subscribes to a mutable AbstractThread instance and publishes its SDK-compatible ThreadStateSnapshot; it does not own or freeze the supplied controller. */
class SnapshotStore<TMessage extends UIMessage> {
  #snapshot: ReturnType<AbstractThread<TMessage>["getSnapshot"]>;
  public readonly thread: AbstractThread<TMessage>;
  public readonly throttleWaitMs: number | undefined;

  public readonly getSnapshot = (): ReturnType<
    AbstractThread<TMessage>["getSnapshot"]
  > => this.#snapshot;

  public constructor(
    thread: AbstractThread<TMessage>,
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
        throttleWaitMs !== undefined &&
        throttleWaitMs !== 0 &&
        !Number.isNaN(throttleWaitMs)
      )
    ) {
      return this.thread.subscribe(publish);
    }

    let lastCall = 0;
    let timeout: ReturnType<typeof setTimeout> | undefined;
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
        timeout = undefined;
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/init-declarations */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/no-undefined */

export { SnapshotStore };
