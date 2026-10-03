import ora from "ora";
import type { Options } from "ora";

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
