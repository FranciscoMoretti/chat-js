/* oxlint-disable import/no-relative-parent-imports  --
 * import/no-relative-parent-imports (#530): Keep the explicit "../file-url" dependency within this package instead of introducing an alias or barrel API.
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import { keyFromFileUrl } from "../file-url";
import type { EveMessageInput } from "./message-input";
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions  --
 * import/no-named-export (#527): Preserve the named eveMessageFileKeys API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * import/prefer-default-export (#532): eveMessageFileKeys remains a named API, consistent with no-default-export; adding future exports must not change caller import syntax.
 * typescript/explicit-function-return-type (#560): Keep eveMessageFileKeys's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep eveMessageFileKeys's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): eveMessageFileKeys accepts message: EveMessageInput; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): eveMessageFileKeys intentionally keeps the existing falsy-value behavior of key; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
export const eveMessageFileKeys = (message: EveMessageInput) => {
  if (typeof message === "string") {
    return [];
  }
  return message.flatMap((part) => {
    if (part.type === "text") {
      return [];
    }
    const key = keyFromFileUrl(part.data);
    if (!key) {
      throw new Error("Invalid attachment reference.");
    }
    return [key];
  });
};
/* oxlint-enable typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */
