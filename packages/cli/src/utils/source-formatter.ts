import path from "node:path";
import { z } from "zod";
import { pathToFileURL } from "node:url";
import type { FormatSource } from "@chat-js/registry-validation/compare";
import { preflight } from "./preflight";

const formatterModuleSchema = z.object({
  formatSource: z.custom<FormatSource>(
    (value) => typeof value === "function",
    "The formatter module must export a formatSource function."
  ),
});

/** Load only an explicitly selected project hook. Registry metadata cannot select executable code. */
export const loadSourceFormatter = async (
  cwd: string,
  modulePath: string
): Promise<FormatSource> => {
  const file = path.relative(cwd, path.resolve(cwd, modulePath));
  await preflight(cwd, [file]);
  const formatterExports: unknown = await import(
    pathToFileURL(path.resolve(cwd, file)).href
  );
  return formatterModuleSchema.parse(formatterExports).formatSource;
};
