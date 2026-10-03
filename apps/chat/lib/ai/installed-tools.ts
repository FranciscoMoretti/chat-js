import type { NativeToolUI } from "@/lib/eve/tool-types";
import type { tools } from "@/tools/chatjs/tools";
import type { WorkflowTools } from "@/tools/chatjs/workflow-types";

type AllTools = typeof tools & WorkflowTools;

/* oxlint-disable id-length  --
 * id-length (#506): InstalledTools uses K as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 * import/no-named-export (#527): Preserve the named InstalledTools API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
export type InstalledTools = {
  [K in keyof AllTools]: NativeToolUI<AllTools[K]>;
};
/* oxlint-enable id-length */
