import type { Options } from "ora";
import ora from "ora";

export const spinner = (
  text: Options["text"],
  options?: { readonly silent?: boolean }
): ReturnType<typeof ora> =>
  ora({
    isSilent: options?.silent,
    text,
  });
