import ora from "ora";
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import type { Options } from "ora";
/* oxlint-enable eslint/sort-imports */

/* oxlint-disable import/prefer-default-export -- Keep the named import contract used by registry consumers and package callers even when this module exposes one value. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
/* oxlint-disable oxc/no-optional-chaining -- Optional access deliberately propagates absence from the external or partially initialized data contract. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
export const spinner = (
  text: Options["text"],
  options?: { silent?: boolean }
): ReturnType<typeof ora> =>
  ora({
    isSilent: options?.silent,
    text,
  });
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable oxc/no-optional-chaining */
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/prefer-default-export */
