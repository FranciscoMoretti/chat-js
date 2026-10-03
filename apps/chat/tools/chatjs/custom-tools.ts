import { defineToolSet } from "@/lib/eve/tool-types";

/* oxlint-disable import/no-named-export, import/prefer-default-export --
 * import/no-named-export (#527): Preserve the named customTools API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * import/prefer-default-export (#532): customTools remains a named API, consistent with no-default-export; adding future exports must not change caller import syntax.
 */
export const customTools = defineToolSet({});
/* oxlint-enable import/no-named-export, import/prefer-default-export */
