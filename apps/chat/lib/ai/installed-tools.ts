import type { NativeToolUI } from "@/lib/eve/tool-types";
import type { tools } from "@/tools/chatjs/tools";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { WorkflowTools } from "@/tools/chatjs/workflow-types";
/* oxlint-enable sort-imports */

type AllTools = typeof tools & WorkflowTools;

/* oxlint-disable import/no-named-export -- Keep the named type bindings (InstalledTools); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable id-length --
 * id-length (#506): InstalledTools uses K as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 */
export type InstalledTools = {
  [K in keyof AllTools]: NativeToolUI<AllTools[K]>;
};
/* oxlint-enable import/no-named-export */
/* oxlint-enable id-length */
