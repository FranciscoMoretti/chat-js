/** Lifecycle, not edit permission. Files outside installation claims are application code. */
export type InstallationFileKind =
  | "application"
  | "source"
  | "generated"
  | "record";

export const installationRecordPaths = [
  "chatjs/installed-source.json",
  "chatjs/installed-source-content.json",
  "chatjs/installed-dependencies.json",
  "chatjs/retained-plugin-schemas.json",
] as const;

const records = new Set<string>(installationRecordPaths);

export const installationFileKind = (
  file: string,
  sourcePaths: ReadonlySet<string>
): InstallationFileKind => {
  if (records.has(file)) {
    return "record";
  }
  if (
    file.startsWith("chatjs/generated/") ||
    file === "lib/ai/models.generated.ts"
  ) {
    return "generated";
  }
  if (
    file.startsWith("integrations/") ||
    file === "chat.config.ts" ||
    file === ".env.example"
  ) {
    return "application";
  }
  return sourcePaths.has(file) ? "source" : "application";
};
