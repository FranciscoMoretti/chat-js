import type { NativeToolUI } from "@/lib/eve/tool-types";
import type { WorkflowTools } from "@/tools/chatjs/workflow-types";
import type { tools } from "@/tools/chatjs/tools";

type AllTools = typeof tools & WorkflowTools;

/* oxlint-disable import/no-named-export -- Keep the named type bindings (InstalledTools); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export type InstalledTools = {
  [ToolName in keyof AllTools]: NativeToolUI<AllTools[ToolName]>;
};
/* oxlint-enable import/no-named-export */
