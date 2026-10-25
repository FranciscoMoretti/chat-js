import type { z } from "zod";

const reservedFields = {
  creation: new Set([
    "operationId",
    "message",
    "modelId",
    "modelIds",
    "selectedTool",
    "fork",
    "forkKind",
  ]),
  history: new Set(["cursor", "ownerScope", "search", "surface"]),
};

/** Compose the exported shapes without silently replacing core or plugin fields. */
export const mergePluginFields = <
  Base extends z.ZodRawShape,
  Added extends z.ZodRawShape,
>(
  kind: keyof typeof reservedFields,
  base: Base,
  added: Added
): Base & Added => {
  for (const key of Object.keys(added)) {
    if (
      reservedFields[kind].has(key) ||
      Object.hasOwn(base, key) ||
      key === "__proto__"
    ) {
      throw new Error(`Duplicate or reserved plugin ${kind} field: ${key}`);
    }
  }
  return { ...base, ...added };
};
