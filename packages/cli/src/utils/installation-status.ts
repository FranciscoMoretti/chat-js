import {
  installationActivation,
  formatActivation,
} from "./installation-activation";
import path from "node:path";
import { directoryFiles } from "./installation-files";
import { pluginSourceFiles, readPluginDescriptors } from "./installed-plugins";
import {
  findSourceReferences,
  schemaSourceClosure,
} from "./plugin-source-references";
import { preflight } from "./preflight";
import { readRetainedSchemas } from "./retained-plugin-schemas";
import { pluginRegistrationTargets } from "./sync-plugins";
import { readReceipt, sourceHashes } from "./source-receipt";

const optionalDirectoryFiles = async (cwd: string, directory: string) => {
  await preflight(cwd, [`${directory}/.ownership-check`]);
  try {
    return await directoryFiles(cwd, directory);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
};

const sourceState = (
  digest: string | null | undefined,
  baseline: string | undefined
) => {
  if (digest === null || digest === undefined) {
    return "missing";
  }
  if (baseline === undefined) {
    return "untracked";
  }
  return baseline === digest ? "unchanged" : "modified";
};

/** Local inventory only: never generates files, updates receipts, or contacts a registry. */
export const installationStatus = async (cwd: string) => {
  const plugins = await readPluginDescriptors(cwd);
  const receipt = await readReceipt(cwd);
  const retained = await readRetainedSchemas(cwd);
  const owners = await Promise.all(
    plugins.map(async (plugin) => {
      const files = [
        ...new Set([
          `plugins/${plugin.id}/chatjs.json`,
          ...pluginSourceFiles(plugin),
          ...(await directoryFiles(cwd, `plugins/${plugin.id}`)),
        ]),
      ].toSorted();
      try {
        const preserved = await schemaSourceClosure(
          cwd,
          plugin.databaseSchemas ?? [],
          plugin.id
        );
        return { plugin, files, preserved, removalIssue: undefined };
      } catch (error) {
        return {
          plugin,
          files,
          preserved: new Set(plugin.databaseSchemas),
          removalIssue:
            error instanceof Error
              ? error.message
              : "Could not inspect schema retention.",
        };
      }
    })
  );
  const targets = new Set(owners.flatMap(({ files }) => files));
  await preflight(cwd, [...targets]);
  const hashes = new Map(await sourceHashes(cwd, [...targets]));
  const references = await findSourceReferences(
    cwd,
    targets,
    new Set(pluginRegistrationTargets)
  );
  const items = owners.map(({ plugin, files, preserved, removalIssue }) => ({
    id: plugin.id,
    descriptor: `plugins/${plugin.id}/chatjs.json`,
    activation: installationActivation(plugin, files),
    removalIssue,
    requires: plugin.requiresPlugins ?? [],
    requiredBy: plugins
      .filter((other) => other.requiresPlugins?.includes(plugin.id) === true)
      .map((other) => other.id),
    files: files.map((file) => {
      const digest = hashes.get(file);
      const state = sourceState(digest, receipt[file]);
      return {
        path: file,
        kind:
          file === `plugins/${plugin.id}/chatjs.json` ? "descriptor" : "source",
        state,
        outsidePluginDirectory: !file.startsWith(`plugins/${plugin.id}/`),
        retainedOnRemoval: preserved.has(file),
      };
    }),
    removalReferences: references.filter(
      ({ file, target }) =>
        files.includes(target) &&
        !preserved.has(target) &&
        (!files.includes(file) || preserved.has(file))
    ),
    sharedFiles: files.filter((file) =>
      owners.some(
        (other) => other.plugin.id !== plugin.id && other.files.includes(file)
      )
    ),
  }));
  const retainedPlugins = await Promise.all(
    Object.entries(retained)
      .filter(([id]) => !plugins.some((plugin) => plugin.id === id))
      .map(async ([id, schemas]) => ({
        id,
        schemas,
        files: await optionalDirectoryFiles(cwd, `plugins/${id}`),
      }))
  );
  const generated = await optionalDirectoryFiles(cwd, "chatjs/generated");
  return {
    project: path.resolve(cwd),
    plugins: items,
    retainedPlugins,
    generated: generated.toSorted(),
    appOwnedIntegrations: [
      ...(await optionalDirectoryFiles(cwd, "integrations")),
    ].toSorted(),
    limitations: [
      "Source states compare against the last recorded installation, not the latest registry release.",
      "Removal references cover relative and @/ static imports, re-exports, and literal dynamic imports; computed imports and custom aliases need review.",
      "Native entries are path-convention matches; exports and framework configuration determine activation. Schema registration does not apply migrations.",
      "Tools, gateways, storage, and sandbox implementations are not included in the plugin inventory.",
    ],
  };
};

export const formatInstallationStatus = (
  status: Awaited<ReturnType<typeof installationStatus>>,
  allFiles: boolean
): string => {
  const lines = [
    "ChatJS file ownership",
    "  chatjs/                 CLI-managed wiring, receipts, and backups",
    "  integrations/           App-owned; add/remove/sync leave it alone",
    "  plugins/<id>/           Editable installed source; tracked for safe replacement/removal",
    "",
  ];
  for (const plugin of status.plugins) {
    const counts = ["unchanged", "modified", "missing", "untracked"].map(
      (state) =>
        `${plugin.files.filter((file) => file.state === state).length} ${state}`
    );
    lines.push(
      `${plugin.id}: ${counts.join(", ")}`,
      `  Descriptor: ${plugin.descriptor}`,
      formatActivation(plugin.activation)
    );
    for (const file of plugin.files) {
      if (
        allFiles ||
        file.state !== "unchanged" ||
        file.outsidePluginDirectory
      ) {
        lines.push(
          `  ${file.state.padEnd(9)} ${file.path}${file.retainedOnRemoval ? " (retained schema source)" : ""}${file.outsidePluginDirectory ? " (plugin-owned framework file)" : ""}`
        );
      }
    }
    if (plugin.removalIssue !== undefined) {
      lines.push(`  Removal needs review: ${plugin.removalIssue}`);
    }
    if (plugin.requires.length) {
      lines.push(`  Requires: ${plugin.requires.join(", ")}`);
    }
    if (plugin.requiredBy.length) {
      lines.push(`  Required by: ${plugin.requiredBy.join(", ")}`);
    }
    for (const reference of plugin.removalReferences) {
      lines.push(
        `  Removal reference: ${reference.file} -> ${reference.target}`
      );
    }
    for (const file of plugin.sharedFiles) {
      lines.push(`  Shared ownership: ${file}`);
    }
    lines.push("");
  }
  if (!status.plugins.length) {
    lines.push("No installed plugins.", "");
  }
  for (const plugin of status.retainedPlugins) {
    lines.push(
      `${plugin.id}: removed; retained source: ${plugin.files.join(", ")}`
    );
  }
  lines.push(
    `Generated files: ${status.generated.length}. Do not edit; use chat-js sync.`,
    "App-owned composition files:",
    ...status.appOwnedIntegrations.map((file) => `  ${file}`),
    "",
    ...status.limitations,
    "Use chat-js remove <plugin> --dry-run for the full removal check. No files were changed."
  );
  return `${lines.join("\n")}\n`;
};
