import path from "node:path";
import { pathToFileURL } from "node:url";
import { z } from "zod";

const validatorSchema = z.object({
  default: z.custom<(env: Readonly<NodeJS.ProcessEnv>) => readonly string[]>(
    (value) => typeof value === "function"
  ),
});

const validatePluginEnvironment = async (
  itemDirectory: string,
  files: readonly string[],
  env: Readonly<NodeJS.ProcessEnv>
): Promise<string[]> => {
  const entry = "validate-env.ts";
  if (
    !files.includes(`chatjs/plugins/${path.basename(itemDirectory)}/${entry}`)
  ) {
    return [];
  }
  try {
    const loadedModule: unknown = await import(
      /* @vite-ignore */
      pathToFileURL(path.join(itemDirectory, entry)).href
    );
    const { default: validateEnvironment } =
      validatorSchema.parse(loadedModule);
    return z.array(z.string()).parse(validateEnvironment(env));
  } catch {
    // Validator exceptions may contain secrets. Keep the aggregate report safe.
    return [
      "Unable to load or run the environment validator. Check validate-env.ts and its default export.",
    ];
  }
};

export { validatePluginEnvironment };
