import type { UIMessage } from "ai";

/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { MemoryThreadState } from "../../src/thread-state";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-enable eslint/sort-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import type { ThreadState } from "../../src/types";
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable import/prefer-default-export -- Keep the named import contract used by registry consumers and package callers even when this module exposes one value. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
/* oxlint-disable typescript/explicit-module-boundary-types -- This exported adapter derives its result from the schema or SDK contract; duplicating that type would erase inference or drift from the source. */
/* oxlint-disable eslint/no-magic-numbers -- These values are concrete test inputs and expected results; naming each literal would make the fixture harder to compare with its assertions. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
export class RecordingThreadState implements ThreadState {
  readonly #state: MemoryThreadState;
  public updateCount = 0;

  public constructor(messages: UIMessage[]) {
    this.#state = new MemoryThreadState({ messages });
  }

  public getSnapshot = () => this.#state.getSnapshot();
  public subscribe = (listener: () => void) => this.#state.subscribe(listener);

  public update: ThreadState["update"] = (updater): void => {
    this.updateCount += 1;
    this.#state.update(updater);
  };
}
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable typescript/explicit-module-boundary-types */
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/prefer-default-export */
