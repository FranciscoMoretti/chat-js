import { z } from "zod";
import { languageModelSchema, modelRoles } from "@/lib/config-models";

const configSchema = z
  .strictObject({ edits: languageModelSchema.default(modelRoles.balanced) })
  .prefault({});
export { configSchema };
