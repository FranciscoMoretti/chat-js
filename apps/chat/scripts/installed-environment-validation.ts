import path from "node:path";
import { pathToFileURL } from "node:url";
import { z } from "zod";

// A validator belongs beside its installed descriptor, never outside the item.
const environmentValidationModuleSchema = z
  .string()
  .regex(/^[a-zA-Z0-9_-]+\.(?:ts|js|mjs)$/u);
const validatorSchema = z.object({
  validateEnvironment: z.custom<
    (env: Readonly<NodeJS.ProcessEnv>) => readonly string[]
  >((value) => typeof value === "function"),
});

const validateInstalledEnvironment = async (
  itemDirectory: string,
  moduleName: string | undefined,
  env: Readonly<NodeJS.ProcessEnv>
): Promise<string[]> => {
  if (moduleName === undefined) {
    return [];
  }
  try {
    const file = environmentValidationModuleSchema.parse(moduleName);
    const loadedModule: unknown = await import(
      /* @vite-ignore */
      pathToFileURL(path.join(itemDirectory, file)).href
    );
    const { validateEnvironment } = validatorSchema.parse(loadedModule);
    return z.array(z.string()).parse(validateEnvironment(env));
  } catch {
    // Validator exceptions may contain secrets. Keep the aggregate report safe.
    return [
      "Unable to load or run the environment validator. Check its module and validateEnvironment export.",
    ];
  }
};

export { validateInstalledEnvironment };
