import { z } from "zod";

const identifier = z
	.string()
	.regex(/^[A-Za-z_$][\w$]*$/)
	.refine((value) => value !== "__proto__", "Reserved registration name");
export const envRequirementSchema = z.object({
	description: z.string().optional(),
	options: z
		.array(z.array(z.string().regex(/^[A-Z_][A-Z0-9_]*$/)).min(1))
		.min(1),
});
export const toolDefinitionSchema = z.object({
	contractVersion: z.literal(1),
	kind: z.literal("tool"),
	id: z.string().regex(/^[a-z][a-z0-9-]*$/),
	toolExport: identifier,
	rendererExport: identifier.optional(),
	slot: z.enum(["webSearch", "codeExecution", "retrieveUrl"]).optional(),
	envRequirements: z.array(envRequirementSchema).default([]),
});
export type ToolDefinition = z.infer<typeof toolDefinitionSchema>;

export const storageDefinitionSchema = z.object({
	contractVersion: z.literal(1),
	kind: z.literal("storage"),
	id: z.string().regex(/^[a-z][a-z0-9-]*$/),
	envRequirements: z.array(envRequirementSchema).default([]),
	optionalEnv: z.array(z.string().regex(/^[A-Z_][A-Z0-9_]*$/)).default([]),
	configKeys: z.array(z.string()).default([]),
});
export type StorageDefinition = z.infer<typeof storageDefinitionSchema>;
