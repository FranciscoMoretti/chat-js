import path from "node:path";
import { z } from "zod";
import { optionalFile } from "./installation-files";
import { preflight } from "./preflight";
import { pluginIdSchema } from "../../../registry/metadata";

export const retainedSchemasFile = "chatjs/retained-plugin-schemas.json";
const schema = z.record(z.string(), z.array(z.string()));

/** Retained schema inputs are not runtime plugin registrations. */
export const readRetainedSchemas = async (cwd: string) => {
  await preflight(cwd, [retainedSchemasFile]);
  const source = await optionalFile(path.join(cwd, retainedSchemasFile));
  const retained = source ? schema.parse(JSON.parse(source.toString())) : {};
  for (const [id, files] of Object.entries(retained)) {
    pluginIdSchema.parse(id);
    for (const file of files) {
      if (!file.startsWith(`chatjs/plugins/${id}/`)) {
        throw new Error(`Retained schema must belong to plugin ${id}: ${file}`);
      }
    }
  }
  await preflight(cwd, Object.values(retained).flat());
  return retained;
};
