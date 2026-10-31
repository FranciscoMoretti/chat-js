import { toolDefinitions } from "./tool-definitions";
import { documentDefinitions } from "./documents";
import { installedToolNames as installedToolNamesInput } from "@/chatjs/generated/installed-tools";

export const installedToolNames: ReadonlySet<string> = new Set([
  ...installedToolNamesInput,
  ...toolDefinitions.map((definition) => definition.name),
]);
export const installedDocumentKinds: ReadonlySet<string> =
  documentDefinitions.kinds;
