/* oxlint-disable import/no-relative-parent-imports  --
 * import/no-relative-parent-imports (#530): Keep the explicit "../config" dependency within this package instead of introducing an alias or barrel API.
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import { installedDocumentKinds } from "@/tools/chatjs/installed-features";

import { config } from "../config";
import type { DocumentAssistantRequest } from "./document-contracts";
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable import/group-exports, max-lines-per-function, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types  --
 * import/group-exports (#523): documentAssistantActions stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named documentAssistantActions API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * max-lines-per-function (#510): documentAssistantActions keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-ternary (#518): documentAssistantActions derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * typescript/explicit-function-return-type (#560): Keep documentAssistantActions's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep documentAssistantActions's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 */
export const documentAssistantActions = (kind: "text" | "code" | "sheet") => {
  if (!installedDocumentKinds.has(kind)) {
    return [];
  }
  switch (kind) {
    case "text": {
      return [
        {
          instruction:
            "Add final polish, check grammar, add section titles for structure, and ensure the document reads smoothly.",
          label: "Add final polish",
          modelId: config.ai.tools.text.polish,
        },
      ];
    }
    case "code": {
      return [
        {
          instruction: "Add comments to the code for understanding.",
          label: "Add comments",
          modelId: config.ai.tools.code.edits,
        },
        {
          instruction: "Add logs to the code for debugging.",
          label: "Add logs",
          modelId: config.ai.tools.code.edits,
        },
      ];
    }
    case "sheet": {
      return [
        {
          instruction: "Format and clean the spreadsheet data.",
          label: "Format and clean data",
          modelId: config.ai.tools.sheet.format,
        },
        ...(installedDocumentKinds.has("code")
          ? [
              {
                instruction:
                  "Analyze and visualize the spreadsheet data by creating a new Python code document.",
                label: "Analyze and visualize data",
                modelId: config.ai.tools.sheet.analyze,
              },
            ]
          : []),
      ];
    }
    default: {
      return [];
    }
  }
};
/* oxlint-enable import/group-exports, max-lines-per-function, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types */

/* oxlint-disable import/group-exports, typescript/prefer-readonly-parameter-types  --
 * import/group-exports (#523): documentAssistantRequest stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named documentAssistantRequest API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * typescript/prefer-readonly-parameter-types (#565): documentAssistantRequest accepts action: ReturnType<typeof documentAssistantActions>[number]; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
export const documentAssistantRequest = (
  action: ReturnType<typeof documentAssistantActions>[number],
  documentId: string,
  revisionId: string
): DocumentAssistantRequest => ({
  message: `${action.instruction}\n\nTarget document: ${documentId}. Selected revision: ${revisionId}. Use readDocument to read this document, then use the document tools to apply the requested changes.`,
  modelId: action.modelId,
});
/* oxlint-enable import/group-exports, typescript/prefer-readonly-parameter-types */
