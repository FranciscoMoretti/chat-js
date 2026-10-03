import { defineState } from "eve/context";

/* oxlint-disable import/no-named-export, import/prefer-default-export, unicorn/no-null --
 * import/no-named-export (#527): Preserve the named projectInstructions API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * import/prefer-default-export (#532): projectInstructions remains a named API, consistent with no-default-export; adding future exports must not change caller import syntax.
 * unicorn/no-null (#570): projectInstructions preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
// Prepared by the turn-start hook, whose failures stop execution. Instruction
// resolvers alone skip failures and must not perform this required database read.
export const projectInstructions = defineState<{ content: string | null }>(
  "chatjs.project-instructions",
  () => ({ content: null })
);
/* oxlint-enable import/no-named-export, import/prefer-default-export, unicorn/no-null */
