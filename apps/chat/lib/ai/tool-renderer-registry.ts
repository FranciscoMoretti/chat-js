import type { tools } from "@/integrations/tools/execution";
import type { WorkflowTools } from "@/chatjs/generated/workflow-types";
import type { ValidatedToolRenderer } from "@/chatjs/core/tools/define-renderer";
import { isValidatedToolRenderer } from "@/chatjs/core/tools/define-renderer";
import { ui } from "@/integrations/tools/ui";

// Execution types constrain registration names only. Each view's payload types
// come from its shared schemas through defineToolRenderer.
type ToolRendererRegistry = {
  [
    Name in keyof typeof tools | keyof WorkflowTools as `tool-${Name}`
  ]?: ValidatedToolRenderer;
};

const toolRendererRegistry: Readonly<
  Partial<Record<string, ValidatedToolRenderer>>
> = ui;

/** Dispatch unknown persisted data only through a validating renderer boundary. */
const getEveInstalledToolRenderer = (
  type: string
): ValidatedToolRenderer | undefined => {
  const renderer = Object.hasOwn(toolRendererRegistry, type)
    ? toolRendererRegistry[type]
    : undefined;
  return isValidatedToolRenderer(renderer) ? renderer : undefined;
};

export { getEveInstalledToolRenderer };
export type { ToolRendererRegistry };
