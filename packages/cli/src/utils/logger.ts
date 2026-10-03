import { highlighter } from "./highlighter";

/* oxlint-disable eslint/no-console -- The CLI logger is the single user-facing stdout/stderr boundary; these console calls implement its public methods. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
export const logger = {
  break(): void {
    console.log("");
  },
  error(...args: unknown[]): void {
    console.log(highlighter.error(args.join(" ")));
  },
  info(...args: unknown[]): void {
    console.log(highlighter.info(args.join(" ")));
  },
  log(...args: unknown[]): void {
    console.log(args.join(" "));
  },
  success(...args: unknown[]): void {
    console.log(highlighter.success(args.join(" ")));
  },
  warn(...args: unknown[]): void {
    console.log(highlighter.warn(args.join(" ")));
  },
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-console */
