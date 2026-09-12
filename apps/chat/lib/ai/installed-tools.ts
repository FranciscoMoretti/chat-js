import type { InferUITool } from "ai";

import { tools } from "@/tools/chatjs/tools";

export const installedTools = tools;

// Derive UI tool types automatically from the registered tools.
// When the CLI adds an entry to tools in tools/chatjs/tools.ts, its typed
// input/output automatically flows into ChatTools via the InstalledTools
// intersection.
export type InstalledTools = {
  [K in keyof typeof installedTools]: InferUITool<(typeof installedTools)[K]>;
};
