import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import {
  pluginDefinitionSchema,
  pluginIdSchema,
} from "../../../registry/metadata";
import type { PluginDefinition } from "../../../registry/metadata";
import { readRetainedSchemas } from "./retained-plugin-schemas";
import { assertCurrentInstallationLayout } from "./installation-layout";
import { preflight } from "./preflight";

const pluginSourceFiles = (definition: PluginDefinition): string[] => [
  ...new Set([
    ...definition.files,
    ...(definition.server
      ? [`chatjs/plugins/${definition.id}/server-plugin.ts`]
      : []),
    ...(definition.chat ? [`chatjs/plugins/${definition.id}/chat.ts`] : []),
    ...(definition.billing
      ? [`chatjs/plugins/${definition.id}/billing.ts`]
      : []),
    ...(definition.signedOut
      ? [`chatjs/plugins/${definition.id}/signed-out.tsx`]
      : []),
    ...(definition.sessionProfile
      ? [`chatjs/plugins/${definition.id}/session-profile.ts`]
      : []),
    ...(definition.cleanup
      ? [`chatjs/plugins/${definition.id}/cleanup.ts`]
      : []),
    ...(definition.client
      ? [`chatjs/plugins/${definition.id}/client-plugin.ts`]
      : []),
    ...(definition.environmentValidation === undefined
      ? []
      : [
          `chatjs/plugins/${definition.id}/${definition.environmentValidation}`,
        ]),
  ]),
];

const readPluginDescriptors = async (
  cwd: string,
  replacing: ReadonlySet<string> = new Set()
): Promise<PluginDefinition[]> => {
  await assertCurrentInstallationLayout(cwd);
  // Validate the parent before readdir can traverse it.
  await preflight(cwd, ["chatjs/plugins/.descriptor-check"]);
  const entries = await readdir(path.join(cwd, "chatjs/plugins"), {
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
        const descriptor = `chatjs/plugins/${id}/chatjs.json`;
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
        const files = pluginSourceFiles(definition);
        // Explicit framework adapters may live outside the plugin directory.
        for (const file of files) {
          if (
            !file.startsWith(`chatjs/plugins/${id}/`) &&
            !file.startsWith("app/") &&
            !file.startsWith("agent/")
          ) {
            throw new Error(`Plugin ${id} cannot claim host source: ${file}`);
          }
        }
        await preflight(cwd, files);
        return definition;
      })
  );
  return plugins.filter((plugin) => plugin !== null);
};
const readInstalledPlugins = async (
  cwd: string,
  replacing: ReadonlySet<string> = new Set()
): Promise<PluginDefinition[]> => {
  const plugins = await readPluginDescriptors(cwd, replacing);
  await Promise.all(
    plugins.flatMap((plugin) =>
      pluginSourceFiles(plugin).map(async (file) => {
        try {
          await readFile(path.join(cwd, file));
        } catch (error) {
          if (
            error instanceof Error &&
            "code" in error &&
            error.code === "ENOENT"
          ) {
            throw new Error(
              `${plugin.id} installation is incomplete. Missing: ${file}. Run chat-js add ${plugin.id}.`,
              { cause: error }
            );
          }
          throw error;
        }
      })
    )
  );
  return plugins;
};
export { readInstalledPlugins, readPluginDescriptors, pluginSourceFiles };
