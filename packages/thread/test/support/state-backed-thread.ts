import type { ChatTransport, UIMessage } from "ai";

import { AbstractThread } from "#thread-source/abstract-thread";
import type { ThreadState } from "#thread-source/types";

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (StateBackedThread); the enabled import/no-default-export convention rejects the default-export alternative. */
export class StateBackedThread extends AbstractThread {
  public constructor(
    state: Readonly<ThreadState>,
    transport?: Readonly<ChatTransport<UIMessage>>
  ) {
    super({ state, transport });
  }
}
/* oxlint-enable import/prefer-default-export, import/no-named-export */
