import type { ToolRendererRegistry } from "@/lib/ai/tool-renderer-registry";

/* oxlint-disable import/no-named-export, import/prefer-default-export --
 * import/no-named-export (#527): Preserve the named customUi API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * import/prefer-default-export (#532): customUi remains a named API, consistent with no-default-export; adding future exports must not change caller import syntax.
 */
export const customUi = {} satisfies Partial<ToolRendererRegistry>;
/* oxlint-enable import/no-named-export, import/prefer-default-export */
