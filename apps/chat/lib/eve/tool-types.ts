import type { ToolDefinition } from "eve/tools";

import type { ToolOutput, ToolResult } from "./tool-result";

export type NativeToolUI<T> =
  T extends ToolDefinition<infer I, infer O>
    ? {
        input: I;
        output: O extends ToolResult<ToolOutput>
          ? Extract<O, { status: "success" }>["output"]
          : O;
      }
    : never;

/** Validate each declared EVE definition without widening its input/output types.
 * The pinned EVE DynamicToolSet erases generics and incorrectly fixes approval input to Record<string, unknown>.
 */
export const defineToolSet = <T>(
  tools: T & {
    [K in keyof T]: T[K] extends ToolDefinition<infer I, infer O>
      ? [O] extends [ToolOutput]
        ? ToolDefinition<I, O>
        : never
      : never;
  }
): T => tools;
