import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import {
  pluginDefinitionSchema,
  pluginIdSchema,
} from "../../../registry/metadata";
import type { PluginDefinition } from "../../../registry/metadata";
import { readRetainedSchemas } from "./retained-plugin-schemas";
import { preflight } from "./preflight";

const readInstalledPlugins = async (
  cwd: string,
  replacing: ReadonlySet<string> = new Set()
): Promise<PluginDefinition[]> => {
  // Validate the parent before readdir can traverse it.
  await preflight(cwd, ["plugins/.descriptor-check"]);
  const entries = await readdir(path.join(cwd, "plugins"), {
    withFileTypes: true,
  }).catch((error: unknown) => {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  });
  const retained = await readRetainedSchemas(cwd);
  const plugins = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory() || entry.isSymbolicLink())
      .filter((entry) => !replacing.has(entry.name))
      .toSorted((a, b) => a.name.localeCompare(b.name))
      .map(async (entry) => {
        const id = pluginIdSchema.parse(entry.name);
        const descriptor = `plugins/${id}/chatjs.json`;
        await preflight(cwd, [descriptor]);
        const content = await readFile(
          path.join(cwd, descriptor),
          "utf-8"
        ).catch((error: unknown) => {
          if (
            error instanceof Error &&
            "code" in error &&
            error.code === "ENOENT"
          ) {
            if (Object.hasOwn(retained, id)) {
              return null;
            }
            throw new Error(
              `${id} is missing its descriptor: ${descriptor}. Run chat-js add ${id} to complete installation.`
            );
          }
          throw error;
        });
        if (content === null) {
          return null;
        }
        const definition = pluginDefinitionSchema.parse(JSON.parse(content));
        if (definition.id !== id) {
          throw new Error(
            `Plugin descriptor id must match its directory: ${id}`
          );
        }
        const files = [
          ...new Set([
            ...definition.files,
            ...(definition.server ? [`plugins/${id}/server-plugin.ts`] : []),
            ...(definition.chat ? [`plugins/${id}/chat.ts`] : []),
            ...(definition.billing ? [`plugins/${id}/billing.ts`] : []),
            ...(definition.signedOut ? [`plugins/${id}/signed-out.tsx`] : []),
            ...(definition.sessionProfile
              ? [`plugins/${id}/session-profile.ts`]
              : []),
            ...(definition.cleanup ? [`plugins/${id}/cleanup.ts`] : []),
            ...(definition.client ? [`plugins/${id}/client-plugin.ts`] : []),
            ...(definition.environmentValidation === undefined
              ? []
              : [`plugins/${id}/${definition.environmentValidation}`]),
          ]),
        ];
        // Explicit framework adapters may live outside the plugin directory.
        for (const file of files) {
          if (
            !file.startsWith(`plugins/${id}/`) &&
            !file.startsWith("app/") &&
            !file.startsWith("agent/")
          ) {
            throw new Error(`Plugin ${id} cannot claim host source: ${file}`);
          }
        }
        await preflight(cwd, files);
        await Promise.all(
          files.map(async (file) => {
            await readFile(path.join(cwd, file), "utf-8").catch(
              (error: unknown) => {
                if (
                  error instanceof Error &&
                  "code" in error &&
                  error.code === "ENOENT"
                ) {
                  throw new Error(
                    `${id} installation is incomplete. Missing: ${file}. Run chat-js add ${id}.`
                  );
                }
                throw error;
              }
            );
          })
        );
        return definition;
      })
  );
  return plugins.filter((plugin) => plugin !== null);
};
export { readInstalledPlugins };
