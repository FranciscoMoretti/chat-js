import type { CanonicalMessage, ThreadInit } from "./types";
import { AbstractThread } from "./abstract-thread";
import { MemoryThreadState } from "./thread-state";
import type { UIMessage } from "ai";

class Thread<
  TMessage extends UIMessage = UIMessage,
> extends AbstractThread<TMessage> {
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Forward native SDK schemas and canonical messages to AbstractThread and MemoryThreadState; recursively readonly arrays fail both receiving contracts.
  public constructor({
    initialTree,
    messages,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding options excludes initialTree, messages from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...options
  }: ThreadInit<TMessage> = {}) {
    super({
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing options own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
      ...options,
      state: new MemoryThreadState<CanonicalMessage<TMessage>>({
        initialTree,
        messages,
      }),
    });
  }
}

const createThread = <TMessage extends UIMessage = UIMessage>(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Forward native SDK construction options to Thread; recursively readonly schemas and canonical messages fail that constructor contract.
  options: ThreadInit<TMessage> = {}
): Thread<TMessage> => new Thread(options);
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (Thread, createThread); the enabled import/no-default-export convention rejects the default-export alternative. */

export { Thread, createThread };
/* oxlint-enable import/no-named-export */
