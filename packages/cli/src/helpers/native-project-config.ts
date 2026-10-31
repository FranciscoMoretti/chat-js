import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import { configSchema, rawConfigSchema } from "shadcn/schema";
import type { Config } from "shadcn/schema";
import { parseJsonObject, requireJsonObject } from "./json-object";

// The public SDK requires resolved paths for native registry prerequisites.
// Let the pinned native CLI resolve aliases; do not duplicate its resolver or
// import private command modules. `info` is read-only and never initializes UI.
export const resolveNativeProjectConfig = async (
  cwd: string,
  config: Partial<Config>
): Promise<Partial<Config>> => {
  const raw = rawConfigSchema.safeParse(config);
  if (!raw.success) {
    // Universal registry items also support an unconfigured host.
    return config;
  }
  const executable = createRequire(import.meta.url).resolve("shadcn");
  const { promise, resolve, reject } = Promise.withResolvers<string>();
  execFile(
    process.execPath,
    [executable, "info", "--json", "--cwd", cwd],
    { cwd },
    // oxlint-disable-next-line promise/prefer-await-to-callbacks -- Node execFile exposes a callback; callers await the promise below.
    (error, output) => {
      if (error) {
        reject(
          new Error(`Native shadcn info failed: ${error.message}`, {
            cause: error,
          })
        );
      } else {
        resolve(output);
      }
    }
  );
  const stdout = await promise;
  const info = parseJsonObject(stdout, "Native shadcn info");
  const project = requireJsonObject(info.config, "Native project config");
  const paths = requireJsonObject(
    project.resolvedPaths,
    "Native resolved paths"
  );
  return configSchema.parse({
    ...raw.data,
    resolvedPaths: { ...paths, tailwindConfig: paths.tailwindConfig ?? "" },
  });
};
