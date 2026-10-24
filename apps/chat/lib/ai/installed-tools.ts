import type { NativeToolUI } from "@/lib/eve/tool-types";
import type { WorkflowTools } from "@/composition/generated/workflow-types";
import type { tools } from "@/composition/generated/tools";

type AllTools = typeof tools & WorkflowTools;

export type InstalledTools = {
  [ToolName in keyof AllTools]: NativeToolUI<AllTools[ToolName]>;
};
