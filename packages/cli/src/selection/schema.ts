import { z } from "zod";

const address = z.string().min(1).max(2048);
export const selectionSchema = z
	.object({
		items: z.array(address).min(1).max(100),
		registries: z
			.record(z.string().regex(/^@[a-zA-Z0-9_-]+$/), z.string().min(1))
			.default({}),
		settings: z
			.object({ model: z.string().min(1).max(200).default("gpt-5-mini") })
			.strict()
			.default({ model: "gpt-5-mini" }),
	})
	.strict();
export type Selection = z.infer<typeof selectionSchema>;

// Composition references are local module imports, never expressions to execute.
const reference = z
	.object({
		path: z
			.string()
			.regex(/^\.\/[a-zA-Z0-9_./-]+$/)
			.refine((path) => !path.split("/").includes("..")),
		export: z.string().regex(/^(default|[A-Za-z_$][A-Za-z0-9_$]*)$/),
	})
	.strict();
export const metadataSchema = z
	.object({
		provides: z.array(z.string().min(1)).default([]),
		requires: z.array(z.string().min(1)).default([]),
		model: reference.optional(),
		layout: reference.optional(),
		renderers: z
			.array(reference.extend({ mount: z.string().regex(/^[a-zA-Z0-9_]+$/) }))
			.default([]),
		components: z.array(reference).default([]),
	})
	.strict();
export type Metadata = z.infer<typeof metadataSchema>;
export const minimalSelection = selectionSchema.parse({
	items: [
		"@chatjs/minimal-next",
		"@chatjs/openai",
		"@chatjs/host-identity",
		"@chatjs/postgres",
		"@chatjs/layout-minimal",
	],
});
