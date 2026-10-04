import type { UIMessage } from "ai";

import { MessageTree } from "./message-tree";
import type { SnapshotInput } from "./message-tree-readers";
import type { ThreadState, ThreadStateSnapshot } from "./types";

// oxlint-disable-next-line eslint/no-undefined -- A ready snapshot has no error; this required field explicitly uses the ThreadStateSnapshot undefined sentinel.
const NO_THREAD_ERROR = undefined;

const createThreadStateSnapshot = <TMessage extends UIMessage>({
  initialTree,
  messages,
}: Readonly<{
  initialTree?: SnapshotInput<TMessage>;
  messages?: readonly TMessage[];
}>): ThreadStateSnapshot<TMessage> => {
  const tree = new MessageTree({ messages, snapshot: initialTree });

  return {
    ...tree.getSnapshot(),
    ...tree.getIndexes(),
    activeRuns: [],
    error: NO_THREAD_ERROR,
    messages: tree.getPath(),
    runs: [],
    status: "ready",
    treeStatus: "ready",
  };
};

class MemoryThreadState<
  TMessage extends UIMessage = UIMessage,
> implements ThreadState<TMessage> {
  readonly #listeners = new Set<() => void>();
  #snapshot: ThreadStateSnapshot<TMessage>;

  public constructor(
    options: Readonly<{
      initialTree?: SnapshotInput<TMessage>;
      messages?: readonly TMessage[];
    }> = {}
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

export { createThreadStateSnapshot, MemoryThreadState };
