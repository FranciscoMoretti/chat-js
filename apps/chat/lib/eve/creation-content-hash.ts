/* oxlint-disable import/no-nodejs-modules, import/no-relative-parent-imports, sort-imports --
 * import/no-nodejs-modules (#529): This server/tooling module requires import { createHash } from "node:crypto";; its Node runtime boundary deliberately permits these built-ins.
 * import/no-relative-parent-imports (#530): Keep the explicit "../ai/types" dependency within this package instead of introducing an alias or barrel API.
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import { createHash } from "node:crypto";

import type { UiToolName } from "../ai/types";
import type { EveMessageInput } from "./message-input";
/* oxlint-enable import/no-nodejs-modules, import/no-relative-parent-imports, sort-imports */

/* oxlint-disable import/no-named-export, import/prefer-default-export, no-ternary, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types --
 * import/no-named-export (#527): Preserve the named eveCreationContentHash API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * import/prefer-default-export (#532): eveCreationContentHash remains a named API, consistent with no-default-export; adding future exports must not change caller import syntax.
 * no-ternary (#518): eveCreationContentHash derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * typescript/explicit-function-return-type (#560): Keep eveCreationContentHash's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep eveCreationContentHash's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): eveCreationContentHash accepts message: EveMessageInput; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
export const eveCreationContentHash = (
  message: EveMessageInput,
  selectedTool?: UiToolName
) => {
  // Preserve the identity of already-reserved requests with automatic tools.
  if (!selectedTool && typeof message === "string") {
    return;
  }
  // oxlint-disable-next-line typescript/consistent-return -- #580: eveCreationContentHash has an optional result; absent or inapplicable records intentionally return undefined rather than a fabricated value.
  return createHash("sha256")
    .update(JSON.stringify(selectedTool ? { message, selectedTool } : message))
    .digest("hex");
};
/* oxlint-enable import/no-named-export, import/prefer-default-export, no-ternary, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types */
