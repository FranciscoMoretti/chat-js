import type { tools } from "@/integrations/tools/execution";
import type { WorkflowTools } from "@/chatjs/generated/workflow-types";
import type { ValidatedToolRenderer } from "@/chatjs/core/tools/define-renderer";
import { isValidatedToolRenderer } from "@/chatjs/core/tools/define-renderer";
import { ui } from "@/integrations/tools/ui";

// Execution types constrain registration names only. Each view's payload types
// come from its shared schemas through defineToolRenderer.
type ToolNames<Execution, Workflows> = Extract<
  keyof Execution | keyof Workflows,
  string
>;
type RenderersFor<Names extends string> = [Names] extends [never]
  ? Record<string, never>
  : Partial<Record<`tool-${Names}`, ValidatedToolRenderer>>;
type ToolRendererRegistry = RenderersFor<
  ToolNames<typeof tools, WorkflowTools>
>;

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
