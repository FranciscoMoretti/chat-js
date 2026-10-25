import {
  installedCreationFields,
  installedSharedPlugins,
} from "@/composition/generated/installed-shared";

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
    ...installedCreationFields,
  })
  .strict()
  .refine(
    (input) =>
      installedSharedPlugins.every(
        (plugin) => plugin.validateCreation?.(input) ?? true
      ),
    "Invalid plugin creation context."
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
