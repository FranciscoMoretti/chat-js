import type { UIMessage } from "ai";

/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { MemoryThreadState } from "../../src/thread-state";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import type { ThreadState } from "../../src/types";
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable eslint/no-magic-numbers -- These values are concrete test inputs and expected results; naming each literal would make the fixture harder to compare with its assertions. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
export class RecordingThreadState implements ThreadState {
  readonly #state: MemoryThreadState;
  public updateCount = 0;

  public constructor(messages: UIMessage[]) {
    this.#state = new MemoryThreadState({ messages });
  }

  public getSnapshot = (): ReturnType<ThreadState["getSnapshot"]> =>
    this.#state.getSnapshot();
  public subscribe = (listener: () => void): (() => void) =>
    this.#state.subscribe(listener);

  public update: ThreadState["update"] = (updater): void => {
    this.updateCount += 1;
    this.#state.update(updater);
  };
}
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-magic-numbers */
