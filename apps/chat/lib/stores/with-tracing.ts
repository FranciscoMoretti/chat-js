"use client";

import type { StateCreator } from "zustand";

type AnyFn = (...args: unknown[]) => unknown;

const safeStringifyArgs = (args: unknown[]) => {
  try {
    return args.map((a) => {
      if (typeof a === "string") {
        return a;
      }
      return JSON.stringify(a);
    });
  } catch {
    return ["<unstringifiable args>"];
  }
};

/**
 * Middleware that wraps all function fields on the store state and logs a stack
 * trace on invocation. Intended for debugging only.
 */
export const withTracing =
  <S>(
    creator: StateCreator<S, [], []>,
    enableTracing: boolean
  ): StateCreator<S, [], []> =>
  (set, get, api) => {
    const base = creator(set, get, api);
    if (!enableTracing) {
      return base;
    }

    const wrapped = { ...(base as Record<string, unknown>) } as Record<
      string,
      unknown
    > as S;

    for (const [key, value] of Object.entries(
      base as Record<string, unknown>
    )) {
      if (typeof value !== "function") {
        continue;
      }

      const fn = value as AnyFn;
      (wrapped as unknown as Record<string, unknown>)[key] = (
        ...args: unknown[]
      ) => {
        const header = `[chat-store] ${key}(${safeStringifyArgs(args).join(
          ", "
        )})`;

        // groupCollapsed isn't available everywhere (e.g. some test envs)
        const groupCollapsed = console.groupCollapsed?.bind(console);
        const groupEnd = console.groupEnd?.bind(console);

        try {
          groupCollapsed?.(header);
          const { stack } = new Error("stack");
          if (stack) {
            // Avoid printing "Error: ..." so it doesn't look like an exception in the console.
            const lines = stack.split("\n");
            // Drop the "Error" header line and the wrapper frame.
            const cleaned = lines.slice(2).join("\n");
            console.debug(cleaned);
          } else {
            console.trace(header);
          }
        } finally {
          groupEnd?.();
        }

        return Reflect.apply(fn, base as unknown as object, args);
      };
    }

    return wrapped;
  };
