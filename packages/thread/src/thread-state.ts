import type { UIMessage } from "ai";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import { MessageTree } from "./message-tree";
/* oxlint-enable sort-imports */
import type { SnapshotInput } from "./message-tree-readers";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { ThreadState, ThreadStateSnapshot } from "./types";
/* oxlint-enable sort-imports */

const NO_THREAD_ERROR = globalThis.undefined;

const createThreadStateSnapshot = <TMessage extends UIMessage>({
  initialTree,
  messages,
}: Readonly<{
  initialTree?: SnapshotInput<TMessage>;
  messages?: readonly TMessage[];
}>): ThreadStateSnapshot<TMessage> => {
  const tree = new MessageTree({ messages, snapshot: initialTree });

  return {
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing tree.getSnapshot() own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    ...tree.getSnapshot(),
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing tree.getIndexes() own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
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

/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (createThreadStateSnapshot, MemoryThreadState); the enabled import/no-default-export convention rejects the default-export alternative. */
export { createThreadStateSnapshot, MemoryThreadState };
/* oxlint-enable import/no-named-export */
