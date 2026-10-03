/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../../tools/platform/research-updates-schema"; "../ai/tool-context" dependency within this package instead of introducing an alias or barrel API.
 */
import type { ToolContext } from "eve/tools";

import type { ResearchUpdate } from "../../tools/platform/research-updates-schema";
import type { ToolProgressWriter } from "../ai/tool-context";
import type { ToolOutput } from "./tool-result";
import { executeWithToolProgress } from "./tool-usage";
import type { ToolUsage } from "./tool-usage";
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable id-length, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/promise-function-async --
 * id-length (#506): executeWithResearchProgress uses T as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 * typescript/explicit-function-return-type (#560): Keep executeWithResearchProgress's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep executeWithResearchProgress's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): executeWithResearchProgress accepts context: Pick<ToolContext, "abortSignal">; options: { abortSignal: AbortSignal; usage: ToolUsage; dataStream: ToolProgressWriter; { abortSignal, usage, publish }; part; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): executeWithResearchProgress preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
export const executeWithResearchProgress = <T extends ToolOutput>(
  context: Pick<ToolContext, "abortSignal">,
  execute: (options: {
    abortSignal: AbortSignal;
    usage: ToolUsage;
    dataStream: ToolProgressWriter;
  }) => Promise<T>
) =>
  executeWithToolProgress<T | { searches: [] }>(
    context,
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
/* oxlint-enable id-length, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/promise-function-async */
