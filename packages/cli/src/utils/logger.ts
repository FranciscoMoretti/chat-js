import { highlighter } from "./highlighter";

export const logger = {
  break() {
    console.log("");
  },
  error(...args: unknown[]) {
    console.log(highlighter.error(String(args.join(" "))));
  },
  info(...args: unknown[]) {
    console.log(highlighter.info(String(args.join(" "))));
  },
  log(...args: unknown[]) {
    console.log(args.join(" "));
  },
  success(...args: unknown[]) {
    console.log(highlighter.success(String(args.join(" "))));
  },
  warn(...args: unknown[]) {
    console.log(highlighter.warn(String(args.join(" "))));
  },
};
