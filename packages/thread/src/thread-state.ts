import type { UIMessage } from "ai";

import { MessageTree } from "./message-tree";
import type {
  MessageTreeSnapshot,
  ThreadState,
  ThreadStateSnapshot,
} from "./types";

/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
/* oxlint-disable eslint/no-undefined -- Undefined represents an omitted optional argument or absent value in the existing TypeScript/SDK contract. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
export const createThreadStateSnapshot = <TMessage extends UIMessage>({
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
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
/* oxlint-disable typescript/explicit-module-boundary-types -- This exported adapter derives its result from the schema or SDK contract; duplicating that type would erase inference or drift from the source. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
export class MemoryThreadState<
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

  public getSnapshot = () => this.#snapshot;

  public subscribe = (listener: () => void) => {
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
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable typescript/explicit-module-boundary-types */
/* oxlint-enable import/group-exports */
