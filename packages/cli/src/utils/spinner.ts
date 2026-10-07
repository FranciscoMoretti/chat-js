import type { Options } from "ora";
import ora from "ora";

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (spinner); the enabled import/no-default-export convention rejects the default-export alternative. */
export const spinner = (
  text: Options["text"],
  options?: { readonly silent?: boolean }
): ReturnType<typeof ora> =>
  ora({
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading silent from options; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
    isSilent: options?.silent,
    text,
  });
/* oxlint-enable import/prefer-default-export, import/no-named-export */
