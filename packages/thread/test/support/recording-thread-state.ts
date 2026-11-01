import { MemoryThreadState } from "#thread-source/thread-state";

import type { ThreadState } from "#thread-source/types";
import type { UIMessage } from "ai";

const ZERO_COUNT = 0;
const COUNT_INCREMENT = 1;
export class RecordingThreadState implements ThreadState {
  readonly #state: MemoryThreadState;
  public updateCount = ZERO_COUNT;

  public constructor(messages: readonly Readonly<UIMessage>[]) {
    this.#state = new MemoryThreadState({ messages });
  }

  public getSnapshot = (): ReturnType<ThreadState["getSnapshot"]> =>
    this.#state.getSnapshot();
  public subscribe = (listener: () => void): (() => void) =>
    this.#state.subscribe(listener);

  public update: ThreadState["update"] = (updater): void => {
    this.updateCount += COUNT_INCREMENT;
    this.#state.update(updater);
  };
}
