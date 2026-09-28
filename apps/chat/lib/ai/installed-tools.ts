import type { NativeToolUI } from "@/lib/eve/tool-types";
import type { tools } from "@/tools/chatjs/tools";

export type InstalledTools = {
  [K in keyof typeof tools]: NativeToolUI<(typeof tools)[K]>;
};
