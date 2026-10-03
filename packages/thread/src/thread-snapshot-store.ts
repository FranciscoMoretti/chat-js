import type { UIMessage } from "ai";

/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import type { AbstractThread } from "./abstract-thread";
/* oxlint-enable eslint/sort-imports */

/* oxlint-disable import/prefer-default-export -- Keep the named import contract used by registry consumers and package callers even when this module exposes one value. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
/* oxlint-disable typescript/explicit-module-boundary-types -- This exported adapter derives its result from the schema or SDK contract; duplicating that type would erase inference or drift from the source. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable eslint/no-undefined -- Undefined represents an omitted optional argument or absent value in the existing TypeScript/SDK contract. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/* oxlint-disable eslint/init-declarations -- The value is assigned by the following guarded operation; an invented initial value would hide an uninitialized control-flow branch. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
export class SnapshotStore<TMessage extends UIMessage> {
  #snapshot: ReturnType<AbstractThread<TMessage>["getSnapshot"]>;
  public readonly thread: AbstractThread<TMessage>;
  public readonly throttleWaitMs: number | undefined;

  public readonly getSnapshot = () => this.#snapshot;

  public constructor(
    thread: AbstractThread<TMessage>,
    throttleWaitMs: number | undefined
  ) {
    this.thread = thread;
    this.throttleWaitMs = throttleWaitMs;
    this.#snapshot = thread.getSnapshot();
  }

  public subscribe = (listener: () => void) => {
    this.#snapshot = this.thread.getSnapshot();
    const { throttleWaitMs } = this;
    const publish = (): void => {
      this.#snapshot = this.thread.getSnapshot();
      listener();
    };
    if (
      !(
        throttleWaitMs !== null &&
        throttleWaitMs !== undefined &&
        throttleWaitMs !== 0 &&
        !Number.isNaN(throttleWaitMs)
      )
    ) {
      return this.thread.subscribe(publish);
    }

    let lastCall = 0;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const notify = (): void => {
      const elapsed = Date.now() - lastCall;
      if (elapsed >= throttleWaitMs) {
        lastCall = Date.now();
        publish();
        return;
      }
      if (timeout) {
        return;
      }
      timeout = setTimeout((): void => {
        timeout = undefined;
        lastCall = Date.now();
        publish();
      }, throttleWaitMs - elapsed);
    };

    const unsubscribe = this.thread.subscribe(notify);
    return (): void => {
      unsubscribe();
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  };
}
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/init-declarations */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/no-undefined */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable typescript/explicit-module-boundary-types */
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/prefer-default-export */
