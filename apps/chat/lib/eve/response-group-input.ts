import { z } from "zod";

import { frontendToolsSchema } from "../ai/types";
import { eveForkInput } from "./contracts";
import { eveMessageInput } from "./message-input";

export const eveResponseGroupInput = z
  .object({
    operationId: z.uuid(),
    modelIds: z.array(z.string().min(1).max(200)).min(2),
    message: eveMessageInput,
    selectedTool: frontendToolsSchema.optional(),
    fork: eveForkInput.optional(),
    projectId: z.uuid().optional(),
  })
  .strict()
  .refine(
    (input) => !(input.fork && input.projectId),
    "Forks inherit their source project."
  )
  .transform((input) => ({
    ...input,
    operationId: input.operationId.toLowerCase(),
  }));
