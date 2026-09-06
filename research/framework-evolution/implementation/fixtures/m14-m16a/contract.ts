import { z } from "zod";

export const revisionRef = z.object({
	documentId: z.uuid(),
	revisionId: z.uuid(),
});
export const textResult = z.object({
	status: z.literal("success"),
	ref: revisionRef,
	kind: z.literal("text"),
	title: z.string(),
});
export type RevisionRef = z.infer<typeof revisionRef>;
export const revision = revisionRef.extend({
	baseRevisionId: z.uuid().nullable(),
	title: z.string(),
	content: z.string(),
});
