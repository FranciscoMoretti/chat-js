import type { ToolRendererRegistry } from "@/lib/ai/tool-renderer-registry";

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing installation composition bindings (customUi); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export const customUi = {} satisfies Partial<ToolRendererRegistry>;
/* oxlint-enable import/prefer-default-export, import/no-named-export */
