import type { ChatTransport, UIMessage } from "ai";

import { AbstractThread } from "../../src/abstract-thread";
import type { ThreadState } from "../../src/types";

export class StateBackedThread extends AbstractThread<UIMessage> {
  constructor(
    state: ThreadState<UIMessage>,
    transport?: ChatTransport<UIMessage>
  ) {
    super({ state, transport });
  }
}
