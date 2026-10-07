import { highlighter } from "./highlighter";

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (logger); the enabled import/no-default-export convention rejects the default-export alternative. */
/* oxlint-disable eslint/no-console -- These CLI display methods emit colored operator messages through console.log; changing their output transport is a separate command-output contract decision. */
export const logger = {
  break(): void {
    console.log("");
  },
  error(...args: readonly unknown[]): void {
    console.log(highlighter.error(args.join(" ")));
  },
  info(...args: readonly unknown[]): void {
    console.log(highlighter.info(args.join(" ")));
  },
  log(...args: readonly unknown[]): void {
    console.log(args.join(" "));
  },
  success(...args: readonly unknown[]): void {
    console.log(highlighter.success(args.join(" ")));
  },
  warn(...args: readonly unknown[]): void {
    console.log(highlighter.warn(args.join(" ")));
  },
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable eslint/no-console */
