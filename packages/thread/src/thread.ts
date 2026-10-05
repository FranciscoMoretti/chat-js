import type { UIMessage } from "ai";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import { AbstractThread } from "./abstract-thread";
/* oxlint-enable sort-imports */
import { MemoryThreadState } from "./thread-state";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { CanonicalMessage, ThreadInit } from "./types";
/* oxlint-enable sort-imports */

/* oxlint-disable typescript/prefer-readonly-parameter-types -- ThreadInit carries SDK message arrays and callbacks into AbstractThread and MemoryThreadState; readonly conversion must preserve those constructor contracts. */
class Thread<
  TMessage extends UIMessage = UIMessage,
> extends AbstractThread<TMessage> {
  public constructor({
    initialTree,
    messages,
    ...options
  }: ThreadInit<TMessage> = {}) {
    super({
      ...options,
      state: new MemoryThreadState<CanonicalMessage<TMessage>>({
        initialTree,
        messages,
      }),
    });
  }
}
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-disable typescript/prefer-readonly-parameter-types -- ThreadInit carries SDK message arrays and callbacks into AbstractThread and MemoryThreadState; readonly conversion must preserve those constructor contracts. */
const createThread = <TMessage extends UIMessage = UIMessage>(
  options: ThreadInit<TMessage> = {}
): Thread<TMessage> => new Thread(options);
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (Thread, createThread); the enabled import/no-default-export convention rejects the default-export alternative. */
/* oxlint-enable typescript/prefer-readonly-parameter-types */

export { Thread, createThread };
/* oxlint-enable import/no-named-export */
