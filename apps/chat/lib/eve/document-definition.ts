import { toolNameSchema } from "@/lib/ai/tool-definition";
import type { z } from "zod";
import { artifactKind } from "@/lib/artifacts/artifact-kind";

export interface DocumentDefinition {
  readonly kind: string;
  readonly contentSchema: z.ZodType<string>;
  readonly createTool: string;
  readonly editTool: string;
}

/** Validate the installation once; callers share the same kind and operation lookup. */
export const composeDocuments = (
  definitions: readonly DocumentDefinition[]
) => {
  const kinds = new Map<string, DocumentDefinition>();
  const operations = new Map<
    string,
    { readonly kind: string; readonly edit: boolean }
  >();
  for (const definition of definitions) {
    artifactKind.parse(definition.kind);
    if (kinds.has(definition.kind)) {
      throw new Error(`Duplicate document kind: ${definition.kind}`);
    }
    kinds.set(definition.kind, definition);
    for (const [name, edit] of [
      [definition.createTool, false],
      [definition.editTool, true],
    ] as const) {
      toolNameSchema.parse(name);
      if (name === "readDocument" || operations.has(name)) {
        throw new Error(`Duplicate or reserved document operation: ${name}`);
      }
      operations.set(name, { kind: definition.kind, edit });
    }
  }
  const installedOperations: ReadonlyMap<
    string,
    { readonly kind: string; readonly edit: boolean }
  > = operations;
  const installedKinds: ReadonlySet<string> = new Set(kinds.keys());
  return {
    kinds: installedKinds,
    operations: installedOperations,
    find: (kind: string): DocumentDefinition | undefined => kinds.get(kind),
    require: (kind: string): DocumentDefinition => {
      const definition = kinds.get(kind);
      if (!definition) {
        throw new Error(`Document kind is unavailable: ${kind}`);
      }
      return definition;
    },
  };
};
