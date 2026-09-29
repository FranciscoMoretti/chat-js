import type { NativeToolUI } from "@/lib/eve/tool-types";
import type { tools } from "@/tools/chatjs/tools";
import type { WorkflowTools } from "@/tools/chatjs/workflow-types";

type AllTools = typeof tools & WorkflowTools;

export type InstalledTools = {
  [K in keyof AllTools]: NativeToolUI<AllTools[K]>;
};
