/* oxlint-disable sort-imports --
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import type { Experimental_VideoModelV4 } from "@ai-sdk/provider";
import type { ImageModel, LanguageModel } from "ai";

import type { AppModelId } from "@/lib/ai/app-model-id";
import type { ResearchUpdate } from "@/tools/platform/research-updates-schema";
/* oxlint-enable sort-imports */

/* oxlint-disable import/group-exports, import/no-named-export, typescript/prefer-readonly-parameter-types --
 * import/group-exports (#523): ToolProgressWriter stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named ToolProgressWriter API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * typescript/prefer-readonly-parameter-types (#565): ToolProgressWriter accepts part: { data: ResearchUpdate; id?: string; type: "data-researchUpdate"; }; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
/** Progress events understood by installed search tools without depending on ChatMessage. */
export interface ToolProgressWriter {
  write: (part: {
    data: ResearchUpdate;
    id?: string;
    type: "data-researchUpdate";
  }) => void;
}
/* oxlint-enable import/group-exports, import/no-named-export, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/group-exports, import/no-named-export --
 * import/group-exports (#523): ToolModelProvider stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named ToolModelProvider API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
export interface ToolModelProvider {
  createImageModel: (modelId: string) => ImageModel;
  createLanguageModel: (modelId: string) => LanguageModel;
  createVideoModel: (modelId: string) => Experimental_VideoModelV4;
  getModelDefinition: (modelId: string) => Promise<{
    apiModelId: string;
    id: AppModelId;
    output: { image: boolean; video: boolean };
  }>;
}
/* oxlint-enable import/group-exports, import/no-named-export */
