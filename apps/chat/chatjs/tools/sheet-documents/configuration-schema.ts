import { z } from "zod";
import { languageModelSchema, modelRoles } from "@/lib/config-models";

const configSchema = z
  .strictObject({
    analyze: languageModelSchema.default(modelRoles.balanced),
    format: languageModelSchema.default(modelRoles.balanced),
  })
  .prefault({});
export { configSchema };
