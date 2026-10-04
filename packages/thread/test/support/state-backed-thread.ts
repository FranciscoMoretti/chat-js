import type { ChatTransport, UIMessage } from "ai";

// oxlint-disable-next-line import/no-relative-parent-imports -- Import the same source class identity; the package self-export resolves to declaration types and breaks private-field compatibility.
import { AbstractThread } from "../../src/abstract-thread";
// oxlint-disable-next-line import/no-relative-parent-imports -- Use source ThreadState without requiring dist before this package's tsc-first test:types command.
import type { ThreadState } from "../../src/types";

export class StateBackedThread extends AbstractThread {
  public constructor(
    state: Readonly<ThreadState>,
    transport?: Readonly<ChatTransport<UIMessage>>
  ) {
    super({ state, transport });
  }
}
