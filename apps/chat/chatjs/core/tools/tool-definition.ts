import { z } from "zod";

export const toolNameSchema = z
  .string()
  .regex(/^[A-Za-z_$][\w$]*$/u)
  .max(100);

/** Shared metadata only: importing this definition must never load execution code. */
export interface ToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: z.ZodType;
  readonly outputSchema: z.ZodType;
  readonly display?: { readonly name: string; readonly shortName: string };
  readonly selectable?: boolean;
}

export const validateToolDefinitions = <T extends ToolDefinition>(
  definitions: readonly T[]
): readonly T[] => {
  const names = new Set<string>();
  for (const definition of definitions) {
    toolNameSchema.parse(definition.name);
    if (names.has(definition.name)) {
      throw new Error(`Duplicate tool definition: ${definition.name}`);
    }
    names.add(definition.name);
  }
  return definitions;
};
