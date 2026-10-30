import {
  installedToolNames as installedToolNamesInput,
  installedDocumentKinds as installedDocumentKindsInput,
} from "@/chatjs/generated/installed-tools";

export const installedToolNames: ReadonlySet<string> = new Set(
  installedToolNamesInput
);
export const installedDocumentKinds: ReadonlySet<string> = new Set(
  installedDocumentKindsInput
);
