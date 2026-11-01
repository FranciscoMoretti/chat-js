import { z } from "zod";
import { imageModelSchema, modelRoles } from "@/lib/config-models";

const configSchema = z
  .strictObject({
    default: imageModelSchema.optional().prefault(modelRoles.image),
  })
  .prefault({});
export { configSchema };
