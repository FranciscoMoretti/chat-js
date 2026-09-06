import { z } from "zod";
export const noteInput = z.object({ note: z.string().min(1).max(1000) });
export const noteOutput = z.object({
	note: z.string(),
	confirmed: z.literal(true),
});
export type ConfirmedNote = z.infer<typeof noteOutput>;
