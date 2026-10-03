import type { UIMessage } from "ai";

/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import { AbstractThread } from "./abstract-thread";
/* oxlint-enable eslint/sort-imports */
import { MemoryThreadState } from "./thread-state";
import type { ThreadInit } from "./types";

/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
/* oxlint-disable oxc/no-rest-spread-properties -- Copying these properties preserves immutable updates and the existing structural API without mutating the source object. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
export class Thread<
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
/* oxlint-enable oxc/no-rest-spread-properties */
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
/* oxlint-disable typescript/explicit-module-boundary-types -- This exported adapter derives its result from the schema or SDK contract; duplicating that type would erase inference or drift from the source. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
export const createThread = <TMessage extends UIMessage = UIMessage>(
  options: ThreadInit<TMessage> = {}
) => new Thread(options);
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable typescript/explicit-module-boundary-types */
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/group-exports */
