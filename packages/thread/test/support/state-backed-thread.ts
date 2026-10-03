import type { ChatTransport, UIMessage } from "ai";

/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { AbstractThread } from "../../src/abstract-thread";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import type { ThreadState } from "../../src/types";
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
export class StateBackedThread extends AbstractThread {
  public constructor(state: ThreadState, transport?: ChatTransport<UIMessage>) {
    super({ state, transport });
  }
}
/* oxlint-enable typescript/prefer-readonly-parameter-types */
