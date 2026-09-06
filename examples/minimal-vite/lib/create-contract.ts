import { z } from "zod";

export const createInput = z
	.object({
		operationId: z.uuid(),
		message: z.string().trim().min(1).max(16000),
	})
	.strict();
