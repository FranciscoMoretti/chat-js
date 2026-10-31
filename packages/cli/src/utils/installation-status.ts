import {
  installationActivation,
  formatActivation,
} from "./installation-activation";
import path from "node:path";
import { compareRegistrySource } from "@chat-js/registry-validation/compare";
import type {
  FormatSource,
  SourceComparison,
} from "@chat-js/registry-validation/compare";
import {
  installationFileKind,
  installationRecordPaths,
} from "./installation-file-kinds";
import {
  directoryFiles,
  optionalDirectoryFiles,
  optionalFile,
} from "./installation-files";
import { pluginSourceFiles, readPluginDescriptors } from "./installed-plugins";
import {
  findSourceReferences,
  schemaSourceClosure,
} from "./plugin-source-references";
import { preflight } from "./preflight";
import { readRetainedSchemas } from "./retained-plugin-schemas";
import { pluginRegistrationTargets } from "./sync-plugins";
import {
  hash,
  readReceipt,
  readSourceBaselines,
  sourceHashes,
} from "./source-receipt";

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
export const installationStatus = async (
  cwd: string,
  options: Readonly<{ formatSource?: FormatSource }> = {}
) => {
  const plugins = await readPluginDescriptors(cwd);
  const receipt = await readReceipt(cwd);
  const retained = await readRetainedSchemas(cwd);
  const owners = await Promise.all(
    plugins.map(async (plugin) => {
      const files = [
        ...new Set([
          `chatjs/plugins/${plugin.id}/chatjs.json`,
          ...pluginSourceFiles(plugin),
          ...(await directoryFiles(cwd, `chatjs/plugins/${plugin.id}`)),
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
  const namespaceGroups = await Promise.all(
    ["chatjs/core", "chatjs/providers", "chatjs/tools"].map(
      async (directory) => await optionalDirectoryFiles(cwd, directory)
    )
  );
  const namespaceFiles = namespaceGroups.flat();
  const targets = new Set([
    ...owners.flatMap(({ files }) => files),
    ...namespaceFiles,
    ...Object.keys(receipt),
  ]);
  await preflight(cwd, [...targets]);
  const modifiedSources = new Map<string, Buffer>();
  const hashes = new Map(
    await sourceHashes(cwd, [...targets], (file, digest, content) => {
      if (
        options.formatSource &&
        content &&
        receipt[file] &&
        receipt[file] !== digest
      ) {
        modifiedSources.set(file, content);
      }
    })
  );
  const baselines = options.formatSource ? await readSourceBaselines(cwd) : {};
  const comparisons = new Map<
    string,
    {
      readonly state: SourceComparison["status"];
      readonly formatting?: string;
    }
  >(
    await Promise.all(
      [...modifiedSources].map(async ([file, content]) => {
        const baseline = baselines[file];
        const bytes =
          baseline === undefined ? undefined : Buffer.from(baseline, "base64");
        if (!bytes || hash(bytes) !== receipt[file]) {
          return [
            file,
            { state: "modified", formatting: "baseline-unavailable" },
          ] as const;
        }
        let original: string;
        let local: string;
        try {
          const decoder = new TextDecoder("utf-8", {
            fatal: true,
            ignoreBOM: true,
          });
          original = decoder.decode(bytes);
          local = decoder.decode(content);
        } catch {
          return [
            file,
            { state: "modified", formatting: "unsupported" },
          ] as const;
        }
        const { status: state, ...detail } = await compareRegistrySource({
          path: file,
          baseline: original,
          local,
          formatSource: options.formatSource,
        });
        return [file, { state, ...detail }] as const;
      })
    )
  );
  const references = await findSourceReferences(
    cwd,
    targets,
    new Set(pluginRegistrationTargets)
  );
  const items = owners.map(({ plugin, files, preserved, removalIssue }) => ({
    id: plugin.id,
    descriptor: `chatjs/plugins/${plugin.id}/chatjs.json`,
    activation: installationActivation(plugin, files),
    removalIssue,
    requires: plugin.requiresPlugins ?? [],
    requiredBy: plugins
      .filter((other) => other.requiresPlugins?.includes(plugin.id) === true)
      .map((other) => other.id),
    files: files.map((file) => {
      const digest = hashes.get(file);
      return {
        path: file,
        kind: "source" as const,
        ...(comparisons.get(file) ?? {
          state: sourceState(digest, receipt[file]),
        }),
        outsidePluginDirectory: !file.startsWith(
          `chatjs/plugins/${plugin.id}/`
        ),
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
        files: await optionalDirectoryFiles(cwd, `chatjs/plugins/${id}`),
      }))
  );
  const generated = await optionalDirectoryFiles(cwd, "chatjs/generated");
  const application = await optionalDirectoryFiles(cwd, "integrations");
  const recordCandidates = await Promise.all(
    installationRecordPaths.map(async (file) => {
      await preflight(cwd, [file]);
      return (await optionalFile(path.join(cwd, file))) ? file : null;
    })
  );
  const records = recordCandidates.filter((file) => file !== null);
  const files = [
    ...new Set([...targets, ...generated, ...application, ...records]),
  ]
    .toSorted()
    .map((file) => {
      const kind = installationFileKind(file, targets);
      return {
        path: file,
        kind,
        ...(kind === "source"
          ? (comparisons.get(file) ?? {
              state: sourceState(hashes.get(file), receipt[file]),
            })
          : {}),
      };
    });
  return {
    project: path.resolve(cwd),
    files,
    plugins: items,
    retainedPlugins,
    limitations: [
      "Source states compare against the last recorded installation, not the latest registry release.",
      "Formatting-only is advisory; replacement and removal still protect every byte change. Old receipts without source content use exact comparison.",
      "Removal references cover relative and @/ static imports, re-exports, and literal dynamic imports; computed imports and custom aliases need review.",
      "Native entries are path-convention matches; exports and framework configuration determine activation. Schema registration does not apply migrations.",
      "Core, tools, and providers are inventoried from their source directories and existing receipts. Removal dependency analysis applies to plugins only. Application files outside integrations/ and recorded paths are not enumerated.",
    ],
  };
};

const formatOtherFiles = (
  status: Awaited<ReturnType<typeof installationStatus>>,
  allFiles: boolean
): string[] => {
  const pluginPaths = new Set(
    status.plugins.flatMap((plugin) => plugin.files.map((file) => file.path))
  );
  return status.files
    .filter(
      (file) =>
        !pluginPaths.has(file.path) &&
        (allFiles || ("state" in file && file.state !== "unchanged"))
    )
    .map(
      (file) =>
        `  ${file.kind.padEnd(12)} ${("state" in file ? (file.state ?? "") : "").padEnd(15)} ${file.path}`
    );
};

export const formatInstallationStatus = (
  status: Awaited<ReturnType<typeof installationStatus>>,
  allFiles: boolean
): string => {
  const lines = [
    "ChatJS file ownership",
    "  application  Your application; installation preserves its composition.",
    "  source       Installed source; local edits are tracked, not automatically merged.",
    "  generated    Derived wiring; change its inputs instead.",
    "  record       Installation bookkeeping; maintained by the CLI.",
    "",
    ...formatOtherFiles(status, allFiles),
    "",
  ];
  for (const plugin of status.plugins) {
    const counts = [
      "unchanged",
      "formatting-only",
      "modified",
      "missing",
      "untracked",
    ].map(
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
          `  ${file.state.padEnd(15)} ${file.path}${"formatting" in file ? ` (formatting: ${file.formatting})` : ""}${file.retainedOnRemoval ? " (retained schema source)" : ""}${file.outsidePluginDirectory ? " (plugin-owned framework file)" : ""}`
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
    `Generated files: ${status.files.filter((file) => file.kind === "generated").length}. Change inputs and regenerate.`,
    `Application files inventoried: ${status.files.filter((file) => file.kind === "application").length}. Composition is preserved.`,
    "",
    ...status.limitations,
    "Use chat-js remove <plugin> --dry-run for the full removal check. No files were changed."
  );
  return `${lines.join("\n")}\n`;
};
