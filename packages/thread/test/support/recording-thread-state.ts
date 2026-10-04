import type { UIMessage } from "ai";

// oxlint-disable-next-line import/no-relative-parent-imports -- Test-only access to MemoryThreadState, which is not exported by the package entrypoints.
import { MemoryThreadState } from "../../src/thread-state";
// oxlint-disable-next-line import/no-relative-parent-imports -- Use the package-internal ThreadState source type in this package test helper.
import type { ThreadState } from "../../src/types";

const ZERO_COUNT = 0;
const COUNT_INCREMENT = 1;
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
export class RecordingThreadState implements ThreadState {
  readonly #state: MemoryThreadState;
  public updateCount = ZERO_COUNT;

  public constructor(messages: UIMessage[]) {
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */
