import type { ChatTransport, UIMessage } from "ai";

import { AbstractThread } from "#thread-source/abstract-thread";
import type { ThreadState } from "#thread-source/types";

export class StateBackedThread extends AbstractThread {
  public constructor(
    state: Readonly<ThreadState>,
    transport?: Readonly<ChatTransport<UIMessage>>
  ) {
    super({ state, transport });
  }
}
