import { defineState } from "eve/context";

/* oxlint-disable unicorn/no-null --
 * unicorn/no-null (#570): projectInstructions preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
// Prepared by the turn-start hook, whose failures stop execution. Instruction
// resolvers alone skip failures and must not perform this required database read.
export const projectInstructions = defineState<{ content: string | null }>(
  "chatjs.project-instructions",
  () => ({ content: null })
);
/* oxlint-enable unicorn/no-null */
