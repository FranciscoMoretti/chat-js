import type { ToolContext } from "eve/tools";

import type { ToolProgressWriter } from "@/lib/ai/tool-context";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { ResearchUpdate } from "@/tools/platform/research-updates-schema";
/* oxlint-enable sort-imports */

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { ToolOutput, ToolResult } from "./tool-result";
/* oxlint-enable sort-imports */
import type { ToolUsage } from "./tool-usage";
import { executeWithToolProgress } from "./tool-usage";

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (executeWithResearchProgress); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable typescript/prefer-readonly-parameter-types --

 * typescript/prefer-readonly-parameter-types (#565): executeWithResearchProgress accepts context: Pick<ToolContext, "abortSignal">; options: { abortSignal: AbortSignal; usage: ToolUsage; dataStream: ToolProgressWriter; { abortSignal, usage, publish }; part; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
  */
export const executeWithResearchProgress = <Output extends ToolOutput>(
  context: Pick<ToolContext, "abortSignal">,
  execute: (options: {
    abortSignal: AbortSignal;
    usage: ToolUsage;
    dataStream: ToolProgressWriter;
  }) => Promise<Output>
): AsyncGenerator<ToolResult<Output | { searches: [] }>> =>
  executeWithToolProgress<Output | { searches: [] }>(
    context,
    // oxlint-disable-next-line typescript/promise-function-async -- Forward the research executor promise and its synchronous throw to executeWithToolProgress without an async wrapper.
    ({ abortSignal, usage, publish }) => {
      const updates = new Map<string, ResearchUpdate>();
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */
