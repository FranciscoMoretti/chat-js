import type { UIMessage } from "ai";

// oxlint-disable-next-line import/no-relative-parent-imports -- Test-only access to MemoryThreadState, which is not exported by the package entrypoints.
import { MemoryThreadState } from "../../src/thread-state";
// oxlint-disable-next-line import/no-relative-parent-imports -- Use the package-internal ThreadState source type in this package test helper.
import type { ThreadState } from "../../src/types";

const ZERO_COUNT = 0;
const COUNT_INCREMENT = 1;
export class RecordingThreadState implements ThreadState {
  readonly #state: MemoryThreadState;
  public updateCount = ZERO_COUNT;

  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- MemoryThreadState receives canonical SDK messages; readonly nested parts cannot satisfy its native message array, while the containing array and messages are readonly.
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
