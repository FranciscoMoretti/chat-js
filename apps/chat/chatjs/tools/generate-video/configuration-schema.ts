import { z } from "zod";
import { videoModelSchema, modelRoles } from "@/lib/config-models";

const configSchema = z
  .strictObject({
    default: videoModelSchema.optional().prefault(modelRoles.video),
  })
  .prefault({});
export { configSchema };
