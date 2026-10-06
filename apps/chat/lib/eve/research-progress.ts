import type { ToolContext } from "eve/tools";

import type { ToolProgressWriter } from "@/lib/ai/tool-context";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import type { ResearchUpdate } from "@/tools/platform/research-updates-schema";
/* oxlint-enable sort-imports */

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { ToolOutput, ToolResult } from "./tool-result";
/* oxlint-enable sort-imports */
import type { ToolUsage } from "./tool-usage";
import { executeWithToolProgress } from "./tool-usage";

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (executeWithResearchProgress); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */

export const executeWithResearchProgress = <Output extends ToolOutput>(
  context: ReadonlyNativeSurface<Pick<ToolContext, "abortSignal">>,
  execute: (
    options: ReadonlyNativeSurface<{
      abortSignal: AbortSignal;
      usage: ToolUsage;
      dataStream: ToolProgressWriter;
    }>
  ) => Promise<Output>
): AsyncGenerator<ToolResult<Output | { searches: [] }>> =>
  executeWithToolProgress<Output | { searches: [] }>(
    context,
    // oxlint-disable-next-line typescript/promise-function-async -- Forward the executor promise and synchronous throw without an async wrapper.
    ({ abortSignal, usage, publish }) => {
      const updates = new Map<string, ReadonlyNativeSurface<ResearchUpdate>>();
      return execute({
        abortSignal,
        dataStream: {
          write(part): void {
            updates.set(part.id ?? `update-${updates.size}`, part.data);
            publish({ searches: [] }, [...updates.values()]);
          },
        },
        usage,
      });
    }
  );
/* oxlint-enable import/prefer-default-export, import/no-named-export */
