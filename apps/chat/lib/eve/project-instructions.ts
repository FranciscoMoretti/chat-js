import { defineState } from "eve/context";

// Prepared by the turn-start hook, whose failures stop execution. Instruction
// resolvers alone skip failures and must not perform this required database read.
export const projectInstructions = defineState<{ content: string | null }>(
  "chatjs.project-instructions",
  () => ({ content: null })
);
