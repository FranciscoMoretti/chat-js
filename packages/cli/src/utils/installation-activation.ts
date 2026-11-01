import {
  pluginDefinitionSchema,
  toolDefinitionSchema,
} from "../../../registry/metadata";
import type {
  PluginDefinition,
  ToolDefinition,
} from "../../../registry/metadata";

const nextEntry =
  /^(?:src\/)?app\/(?:.*\/)?(?<entry>page|layout|route|loading|error|not-found|template|default|global-error)\.[jt]sx?$/u;
// Native authored paths used by EVE 0.80.1. Helpers outside these conventions stay unclassified.
const eveEntries = [
  /^agent\/(?:subagents\/[^/]+\/)*(?<entry>hooks|tools|channels)\/.+\.[cm]?[jt]s$/u,
  /^agent\/(?:subagents\/[^/]+\/)*(?<entry>agent|sandbox)\.[cm]?[jt]s$/u,
  /^agent\/(?:subagents\/[^/]+\/)*(?<entry>instructions|system)(?:\/[^/]+)?\.(?:md|[cm]?[jt]s)$/u,
];
const fixtureSource = /\.(?:test|spec|visual)\.[cm]?[jt]sx?$/u;

const enabledNames = (
  entries: readonly (readonly [string, unknown])[]
): string[] =>
  entries.filter(([, enabled]) => Boolean(enabled)).map(([name]) => name);

const clientIntegrations = (client: PluginDefinition["client"]): string[] => {
  if (!client) {
    return [];
  }
  return enabledNames([
    ["layout", client.layout],
    [
      "chat/ui",
      [
        !client.layout,
        client.chat,
        client.accountSummary,
        client.uploads,
        client.modelVisibility,
        client.composerControls.length,
        client.settingsItems.length,
      ].some(Boolean),
    ],
    ["chat/uploads", client.uploads],
    ["chat/model-visibility", client.modelVisibility],
  ]);
};

const pluginIntegrations = (value: PluginDefinition): string[] => [
  ...enabledNames([
    ["chat/server", value.chat],
    ["billing", value.billing],
    ["auth/signed-out", value.signedOut],
    ["chat/session-profiles", value.sessionProfile],
    ["cleanup", value.cleanup],
    ["auth/server", value.authentication],
    ["auth/form", value.authenticationUi],
    ["auth/sign-out", value.authenticationUi],
    ["navigation", value.navigation],
    ["database", value.databaseSchemas?.length],
    ["routers", value.server?.routers.length],
    ["instrumentation", value.server?.instrumentation],
  ]),
  ...clientIntegrations(value.client),
];

const toolIntegrations = (value: ToolDefinition): string[] =>
  enabledNames([
    ["tools/execution", true],
    ["tools/catalog", true],
    ["tools/ui", value.tools.some((item) => item.rendererExport !== undefined)],
    [
      "tools/definitions",
      value.tools.some((item) => item.definitionExport !== undefined),
    ],
    ["tools/composer", value.tools.some((item) => item.composer !== undefined)],
    [
      "tools/selection",
      value.tools.some(
        (item) =>
          item.composer !== undefined || item.definitionExport !== undefined
      ),
    ],
    ["tools/configuration", value.config],
    ["tools/availability", value.availabilityExport],
    ["tools/providers", value.slot],
    ["documents/definitions", value.documentKind],
    ["documents/ui", value.documentKind],
    ["documents/run", value.documentRunExport],
    ["tools/code-executor", value.codeExecutorExport],
  ]);

/** Inventory descriptor wiring and known native path conventions; never execute source. */
export const installationActivation = (
  metadata: unknown,
  paths: readonly string[]
) => {
  const plugin = pluginDefinitionSchema.safeParse(metadata);
  const tool = toolDefinitionSchema.safeParse(metadata);
  const integrations = new Set([
    ...(plugin.success ? pluginIntegrations(plugin.data) : []),
    ...(tool.success ? toolIntegrations(tool.data) : []),
  ]);
  const nativeEntryPoints: { path: string; convention: string }[] = [];
  const frameworkFiles: string[] = [];
  for (const file of [...new Set(paths)].toSorted()) {
    if (fixtureSource.test(file)) {
      continue;
    }
    const next = nextEntry.exec(file);
    const eve = eveEntries
      .map((pattern) => pattern.exec(file))
      .find((match) => match !== null);
    if (next) {
      nativeEntryPoints.push({
        path: file,
        convention: `Next.js ${next.groups?.entry}`,
      });
    } else if (eve) {
      nativeEntryPoints.push({
        path: file,
        convention: `EVE ${eve.groups?.entry}`,
      });
    } else if (
      file.startsWith("app/") ||
      file.startsWith("agent/") ||
      file.startsWith("src/app/")
    ) {
      frameworkFiles.push(file);
    }
  }
  return {
    integrations: [...integrations]
      .toSorted()
      .map((name) => `integrations/${name}.ts`),
    nativeEntryPoints,
    frameworkFiles,
    note: "Native entries match framework path conventions; exports and framework configuration determine activation. Other framework files are source, not confirmed entry points. Database schemas do not apply migrations.",
  };
};

export const formatActivation = (
  inventory: ReturnType<typeof installationActivation>
): string =>
  [
    ...inventory.integrations.map(
      (file) => `  App-owned composition (preserved): ${file}`
    ),
    ...inventory.nativeEntryPoints.map(
      (entry) => `  Native convention (${entry.convention}): ${entry.path}`
    ),
    ...inventory.frameworkFiles.map(
      (file) => `  Framework source (activation not inferred): ${file}`
    ),
  ].join("\n");
