import type { NativeToolUI } from "@/lib/eve/tool-types";
import type { WorkflowTools } from "@/tools/chatjs/workflow-types";
import type { tools } from "@/tools/chatjs/tools";

type AllTools = typeof tools & WorkflowTools;

export type InstalledTools = {
  [ToolName in keyof AllTools]: NativeToolUI<AllTools[ToolName]>;
};
