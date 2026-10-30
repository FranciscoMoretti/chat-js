import type { NativeToolUI } from "@/lib/eve/tool-types";
import type { WorkflowTools } from "@/chatjs/generated/workflow-types";
import type { tools } from "@/chatjs/generated/tools";

type AllTools = typeof tools & WorkflowTools;

export type InstalledTools = {
  [ToolName in keyof AllTools]: NativeToolUI<AllTools[ToolName]>;
};
