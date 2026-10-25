import { projectSelectionAvailable } from "./project-creation";

import { z } from "zod";

import { frontendToolsSchema } from "@/lib/ai/types";

import { eveForkInput } from "./contracts";
import { eveMessageInput } from "./message-input";

export const eveResponseGroupInput = z
  .object({
    operationId: z.uuid(),
    modelIds: z.array(z.string().min(1).max(200)).min(2),
    message: eveMessageInput,
    selectedTool: frontendToolsSchema.optional(),
    fork: eveForkInput.optional(),
    forkKind: z.enum(["edit", "comparison"]).optional(),
    projectId: z.uuid().optional(),
  })
  .strict()
  .refine(
    (input) => !(input.fork !== undefined && input.projectId !== undefined),
    "Forks inherit their source project."
  )
  .refine(
    (input) => projectSelectionAvailable(input.projectId),
    "Projects plugin is not installed."
  )
  .refine(
    (input: {
      readonly forkKind?: "edit" | "comparison";
      readonly fork?: z.infer<typeof eveForkInput>;
    }) => !input.forkKind || input.fork !== undefined,
    "Fork intent requires a source conversation."
  )
  .transform((input) => ({
    ...input,
    operationId: input.operationId.toLowerCase(),
  }));
