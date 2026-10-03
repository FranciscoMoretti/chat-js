import type { UIMessage } from "ai";

import { AbstractThread } from "./abstract-thread";
import { MemoryThreadState } from "./thread-state";
import type { ThreadInit } from "./types";

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
      state: new MemoryThreadState({ initialTree, messages }),
    });
  }
}
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-disable typescript/prefer-readonly-parameter-types -- ThreadInit carries SDK message arrays and callbacks into AbstractThread and MemoryThreadState; readonly conversion must preserve those constructor contracts. */
const createThread = <TMessage extends UIMessage = UIMessage>(
  options: ThreadInit<TMessage> = {}
): Thread<TMessage> => new Thread(options);
/* oxlint-enable typescript/prefer-readonly-parameter-types */

export { Thread, createThread };
