import type { UIMessage } from "ai";

import { MessageTree } from "./message-tree";
import type {
  MessageTreeSnapshot,
  ThreadState,
  ThreadStateSnapshot,
} from "./types";

/* oxlint-disable eslint/no-undefined -- Undefined represents an omitted optional argument or absent value in the existing TypeScript/SDK contract. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- ThreadState.update accepts a synchronous snapshot updater and commits its mutable SDK message-array snapshot; constructor inputs are passed to MessageTree using that same contract. */
const createThreadStateSnapshot = <TMessage extends UIMessage>({
  initialTree,
  messages,
}: {
  initialTree?: MessageTreeSnapshot<TMessage>;
  messages?: TMessage[];
}): ThreadStateSnapshot<TMessage> => {
  const tree = new MessageTree({ messages, snapshot: initialTree });

  return {
    ...tree.getSnapshot(),
    ...tree.getIndexes(),
    activeRuns: [],
    error: undefined,
    messages: tree.getPath(),
    runs: [],
    status: "ready",
    treeStatus: "ready",
  };
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-undefined */

/* oxlint-disable typescript/prefer-readonly-parameter-types -- ThreadState.update accepts a synchronous snapshot updater and commits its mutable SDK message-array snapshot; constructor inputs are passed to MessageTree using that same contract. */
class MemoryThreadState<
  TMessage extends UIMessage = UIMessage,
> implements ThreadState<TMessage> {
  readonly #listeners = new Set<() => void>();
  #snapshot: ThreadStateSnapshot<TMessage>;

  public constructor(
    options: {
      initialTree?: MessageTreeSnapshot<TMessage>;
      messages?: TMessage[];
    } = {}
  ) {
    this.#snapshot = createThreadStateSnapshot(options);
  }

  public getSnapshot = (): ThreadStateSnapshot<TMessage> => this.#snapshot;

  public subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return (): void => {
      this.#listeners.delete(listener);
    };
  };

  public update: ThreadState<TMessage>["update"] = (updater): void => {
    this.#snapshot = updater(this.#snapshot);
    for (const listener of this.#listeners) {
      listener();
    }
  };
}
/* oxlint-enable typescript/prefer-readonly-parameter-types */

export { createThreadStateSnapshot, MemoryThreadState };
