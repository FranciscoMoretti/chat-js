import ora from "ora";
import type { Options } from "ora";

export const spinner = (
  text: Options["text"],
  options?: { silent?: boolean }
): ReturnType<typeof ora> =>
  ora({
    isSilent: options?.silent,
    text,
  });
