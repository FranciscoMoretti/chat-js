import type { Options } from "ora";
import ora from "ora";

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (spinner); the enabled import/no-default-export convention rejects the default-export alternative. */
export const spinner = (
  text: Options["text"],
  options?: { readonly silent?: boolean }
): ReturnType<typeof ora> =>
  ora({
    isSilent: options?.silent,
    text,
  });
/* oxlint-enable import/prefer-default-export, import/no-named-export */
