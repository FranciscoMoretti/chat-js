import { assertUiCompatibility } from "./ui-compatibility";
import { writeGeneratedFiles } from "./write-generated-files";
import { assertCurrentInstallationLayout } from "./installation-layout";
import { rm } from "node:fs/promises";
import path from "node:path";
import type { PluginDefinition } from "../../../registry/metadata";
import {
  pluginHasInstrumentationEntry,
  pluginHasServerEntry,
} from "../../../registry/metadata";
import { readInstalledPlugins } from "./installed-plugins";
import { planDatabaseSchemas } from "./sync-database";
import { generatedRegistrationSource } from "./generated-registration-source";
import { pluginBindings } from "./plugin-bindings";
import { pluginItems } from "../../../registry/src/plugins/catalog";

const assertPluginDependencies = (
  plugins: readonly PluginDefinition[]
): void => {
  const ids = new Set(plugins.map((plugin) => plugin.id));
  for (const plugin of plugins) {
    for (const dependency of plugin.requiresPlugins ?? []) {
      if (!ids.has(dependency)) {
        throw new Error(
          `${plugin.id} requires installed plugin: ${dependency}`
        );
      }
    }
  }
};

const assertRuntimeContributions = (
  plugins: readonly PluginDefinition[]
): void => {
  const authenticators = new Set(["chatjs-gateway"]);
  const cleanupIds = new Set(["orphanedAttachments"]);
  let signedOut = false;
  for (const plugin of plugins) {
    if (plugin.signedOut) {
      if (signedOut) {
        throw new Error("Only one plugin may supply the signed-out screen.");
      }
      signedOut = true;
    }
    for (const [key, seen] of [
      [plugin.sessionProfile?.authenticator, authenticators],
      [plugin.cleanup?.id, cleanupIds],
    ] as const) {
      if (typeof key === "string" && key !== "") {
        if (seen.has(key)) {
          throw new Error(`Duplicate or reserved plugin identity: ${key}`);
        }
        seen.add(key);
      }
    }
  }
};

const assertUniqueContributions = (
  plugins: readonly PluginDefinition[]
): void => {
  const controls = new Set(["deep-research", "image", "video"]);
  const settings = new Set(["general"]);
  const exclusive = new Set<string>();
  for (const plugin of plugins) {
    for (const [keys, seen, label] of [
      [plugin.client?.composerControls ?? [], controls, "composer control"],
      [plugin.client?.settingsItems ?? [], settings, "settings item"],
    ] as const) {
      for (const key of keys) {
        if (seen.has(key)) {
          throw new Error(`Duplicate or reserved plugin ${label}: ${key}`);
        }
        seen.add(key);
      }
    }
    for (const [present, label] of [
      [plugin.authentication, "authentication"],
      [plugin.authenticationUi, "authentication UI"],
      [plugin.navigation, "modified navigation"],
      [plugin.billing, "usage billing"],
      [plugin.client?.modelVisibility, "model visibility"],
      [plugin.client?.uploads, "attachment uploads"],
    ] as const) {
      if (present === undefined) {
        continue;
      }
      if (exclusive.has(label)) {
        throw new Error(`Only one plugin may supply ${label}.`);
      }
      exclusive.add(label);
    }
  }
  assertPluginDependencies(plugins);
  assertRuntimeContributions(plugins);
};

const namedEntries = (
  plugins: readonly PluginDefinition[],
  module: string,
  exportedName: (plugin: PluginDefinition) => string | undefined,
  reserved: readonly string[]
) => {
  const sources = plugins.flatMap((plugin) => {
    const preferred = exportedName(plugin);
    return preferred === undefined
      ? []
      : [{ plugin, id: plugin.id, preferred }];
  });
  return pluginBindings(sources, reserved).map(
    ({ plugin, preferred, name }) => {
      const binding =
        name === preferred ? preferred : `${preferred} as ${name}`;
      return {
        plugin,
        name,
        source: `import { ${binding} } from "@/chatjs/plugins/${plugin.id}/${module}";`,
      };
    }
  );
};

const clientEntries = (
  plugins: readonly PluginDefinition[],
  reserved: readonly string[]
) =>
  namedEntries(
    plugins,
    "client-plugin",
    (plugin) => plugin.client?.export,
    reserved
  );

const imports = (entries: readonly { readonly source: string }[]): string =>
  entries.map(({ source }) => source).join("\n");

const pluginTitle = (id: string): string =>
  id
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");

const renderRouters = (plugins: readonly PluginDefinition[]): string => {
  const entries = plugins.filter(pluginHasServerEntry);
  if (entries.length === 0) {
    return "export const installedRouters = {};";
  }
  const factories = pluginBindings(
    entries.map(({ id }) => ({
      id,
      preferred: `create${pluginTitle(id)}Plugin`,
    })),
    []
  );
  const bindings = pluginBindings(
    factories.map(({ id, name: factory }) => ({
      id,
      factory,
      preferred: `${id.charAt(0)}${pluginTitle(id).slice(1)}Plugin`,
    })),
    factories.map(({ name }) => name)
  );
  return `${bindings.map(({ id, factory }) => `import ${factory} from "@/chatjs/plugins/${id}/server-plugin";`).join("\n")}
import { assertUniquePluginRouters, type ChatPlugin } from "@/chatjs/core/installation/plugin";

${bindings.map(({ name, factory }) => `const ${name} = Object.assign({ routers: {} }, ${factory}() satisfies ChatPlugin);`).join("\n")}

assertUniquePluginRouters([${bindings.map(({ name }) => name).join(", ")}]);

export const installedRouters = { ${bindings.map(({ name }) => `...${name}.routers`).join(", ")} };`;
};

const renderInstrumentation = (
  plugins: readonly PluginDefinition[]
): string => {
  const entries = plugins.filter(pluginHasInstrumentationEntry);
  return `import type { InstrumentationRegistration } from "@/chatjs/core/installation/contracts";

export const installedInstrumentation: readonly InstrumentationRegistration[] = [${entries
    .map(
      ({ id }) => `async () => {
  const { default: register${pluginTitle(id)} } = await import("@/chatjs/plugins/${id}/instrumentation");
  await register${pluginTitle(id)}();
}`
    )
    .join(",\n")}];`;
};

const billingRegistration = (plugins: readonly PluginDefinition[]): string => {
  const plugin = plugins.find((candidate) => candidate.billing);
  const billing = plugin?.billing;
  return `${billing ? `import { ${billing.export} as pluginBilling } from "@/chatjs/plugins/${plugin?.id}/billing";` : ""}
import type { UsageBilling } from "@/chatjs/core/billing/contracts";
export const installedBilling: readonly UsageBilling[] = [${billing ? "pluginBilling" : ""}];`;
};

const renderPluginRegistrations = (
  plugins: readonly PluginDefinition[],
  databaseSchemas: string
): Map<string, string> => {
  const layout = clientEntries(
    plugins.filter((plugin) => plugin.client?.layout),
    ["UiPlugin", "installedLayoutPlugins"]
  );
  const uploads = clientEntries(
    plugins.filter((plugin) => plugin.client?.uploads),
    ["AttachmentUploadIntegration", "installedUploads"]
  );
  const modelVisibility = clientEntries(
    plugins.filter((plugin) => plugin.client?.modelVisibility),
    ["ModelVisibility", "installedModelVisibility"]
  );
  const chat = namedEntries(plugins, "chat", (plugin) => plugin.chat?.export, [
    "ChatServerIntegration",
    "installedChat",
  ]);
  const chatUi = clientEntries(
    plugins.filter(
      ({ client }) =>
        client !== undefined &&
        (client.layout !== true ||
          client.chat === true ||
          client.accountSummary === true ||
          client.composerControls.length > 0 ||
          client.settingsItems.length > 0)
    ),
    ["UiPlugin", "installedChatPlugins"]
  );
  const signedOut = plugins.find((plugin) => plugin.signedOut);
  const profiles = namedEntries(
    plugins,
    "session-profile",
    (plugin) => plugin.sessionProfile?.export,
    ["Error", "SessionProfile", "installedSessionProfiles"]
  );
  const cleanup = namedEntries(
    plugins,
    "cleanup",
    (plugin) => plugin.cleanup?.export,
    ["Error", "CleanupTask", "installedCleanupTasks"]
  );
  const authentication = plugins.find((plugin) => plugin.authentication);
  const authUi = plugins.find((plugin) => plugin.authenticationUi);
  const navigation = plugins.filter((plugin) => plugin.navigation);
  const contents = [
    [
      "installed-signed-out",
      `${signedOut ? `import { ${signedOut.signedOut?.export} as pluginScreen } from "@/chatjs/plugins/${signedOut.id}/signed-out";` : ""}
import type { ComponentType } from "react";
export const installedSignedOutScreens: readonly ComponentType[] = [${signedOut ? "pluginScreen" : ""}];`,
    ],
    [
      "installed-session-profiles",
      `${imports(profiles)}
import type { SessionProfile } from "@/chatjs/core/session/contracts";
${profiles.map(({ plugin, name }) => `if (${name}.authenticator !== ${JSON.stringify(plugin.sessionProfile?.authenticator)}) throw new Error("Session profile identity disagrees with its descriptor.");`).join("\n")}
export const installedSessionProfiles: readonly SessionProfile[] = [${profiles.map(({ name }) => name).join(", ")}];`,
    ],
    [
      "installed-cleanup",
      `${imports(cleanup)}
import type { CleanupTask } from "@/lib/cleanup/contracts";
${cleanup.map(({ plugin, name }) => `if (${name}.id !== ${JSON.stringify(plugin.cleanup?.id)}) throw new Error("Cleanup identity disagrees with its descriptor.");`).join("\n")}
export const installedCleanupTasks: readonly CleanupTask[] = [${cleanup.map(({ name }) => name).join(", ")}];`,
    ],
    [
      "installed-auth",
      `${authentication ? `import { ${authentication.authentication?.export} as pluginAuth } from "@/chatjs/plugins/${authentication.id}/auth-server";` : ""}
import type { AuthenticationIntegration } from "@/chatjs/core/authentication/contracts";
export const installedAuth: readonly AuthenticationIntegration[] = [${authentication ? "pluginAuth" : ""}];`,
    ],
    [
      "installed-auth-ui",
      `${authUi ? `import { ${authUi.authenticationUi?.form} as pluginForm } from "@/chatjs/plugins/${authUi.id}/auth-form";` : ""}
import type { AuthenticationUi } from "@/chatjs/core/authentication/contracts";
export const installedAuthenticationForms: readonly AuthenticationUi["Form"][] = [${authUi ? "pluginForm" : ""}];`,
    ],
    [
      "installed-sign-out",
      `${authUi ? `import { ${authUi.authenticationUi?.signOut} as pluginSignOut } from "@/chatjs/plugins/${authUi.id}/sign-out";` : ""}
import type { AuthenticationUi } from "@/chatjs/core/authentication/contracts";
export const installedSignOutHandlers: readonly AuthenticationUi["signOut"][] = [${authUi ? "pluginSignOut" : ""}];`,
    ],
    [
      "installed-navigation",
      `${navigation.map((plugin) => `import { ${plugin.navigation?.export} as navigate } from "@/chatjs/plugins/${plugin.id}/navigation";`).join("\n")}
export const installedNavigationHandlers: readonly (() => boolean)[] = [${navigation.length > 0 ? "navigate" : ""}];`,
    ],
    ["installed-billing", billingRegistration(plugins)],
    [
      "installed-model-visibility",
      `${imports(modelVisibility)}\nimport type { ModelVisibility } from "@/chatjs/core/installation/contracts";\nexport const installedModelVisibility: readonly ModelVisibility[] = [${modelVisibility.map(({ name }) => `${name}.useModelVisibility`).join(", ")}];`,
    ],
    [
      "installed-chat",
      `${imports(chat)}\nimport type { ChatServerIntegration } from "@/chatjs/core/chat/contracts";\nexport const installedChat: readonly ChatServerIntegration[] = [${chat.map(({ name }) => name).join(", ")}];`,
    ],
    [
      "installed-chat-ui",
      `"use client";\n${imports(chatUi)}\nimport type { UiPlugin } from "@/chatjs/core/ui/slots";\nexport const installedChatPlugins: readonly UiPlugin[] = [${chatUi.map(({ name }) => name).join(", ")}];`,
    ],
    [
      "installed",
      `export const installedPlugins: ReadonlySet<string> = new Set(${plugins.length > 0 ? JSON.stringify(plugins.map((plugin) => plugin.id)) : ""});`,
    ],
    ["installed-routers", renderRouters(plugins)],
    ["installed-instrumentation", renderInstrumentation(plugins)],
    [
      "installed-layout",
      `"use client";\n${imports(layout)}\nimport type { UiPlugin } from "@/chatjs/core/ui/slots";\nexport const installedLayoutPlugins: readonly UiPlugin[] = [${layout.map(({ name }) => name).join(", ")}];`,
    ],
    [
      "installed-uploads",
      `${imports(uploads)}\nimport type { AttachmentUploadIntegration } from "@/chatjs/core/installation/contracts";\nexport const installedUploads: readonly AttachmentUploadIntegration[] = [${uploads.map(({ name }) => `${name}.uploads`).join(", ")}];`,
    ],
  ] as const;
  return new Map([
    ["chatjs/generated/installed-database.ts", databaseSchemas],
    ...contents.map(
      ([name, content]) =>
        [
          `chatjs/generated/${name}.ts`,
          generatedRegistrationSource(
            `// Generated by chat-js sync. Do not edit. Customize integrations/ or plugin source; inspect ownership with chat-js status.\n${content}\n`
          ),
        ] as const
    ),
  ]);
};
const pluginRegistrationTargets = [...renderPluginRegistrations([], "").keys()];

const planPluginRegistrations = async (
  cwd: string,
  plugins: readonly PluginDefinition[],
  retainedSchemas?: Readonly<Record<string, readonly string[]>>
): Promise<Map<string, string>> => {
  await assertCurrentInstallationLayout(cwd);
  await assertUiCompatibility(cwd, plugins);
  assertUniqueContributions(plugins);
  const databaseSchemas = await planDatabaseSchemas(
    cwd,
    plugins.map((plugin) => plugin.id),
    retainedSchemas
  );
  return renderPluginRegistrations(plugins, databaseSchemas);
};

const syncPlugins = async (
  cwd: string,
  options: Readonly<{ expected?: readonly string[] }> = {}
): Promise<void> => {
  await assertCurrentInstallationLayout(cwd);
  const plugins = await readInstalledPlugins(cwd);
  for (const id of options.expected ?? []) {
    if (!plugins.some((plugin) => plugin.id === id)) {
      throw new Error(
        `Missing plugin descriptor: chatjs/plugins/${id}/chatjs.json`
      );
    }
  }
  await writeGeneratedFiles(cwd, await planPluginRegistrations(cwd, plugins));
};

// Creation removes reference plugins; app-owned composition never needs source edits.
const initializePluginUi = async (cwd: string): Promise<void> => {
  // The reference preset's plugin sources, including adapters, are explicit.
  await Promise.all(
    pluginItems.flatMap((item) =>
      (item.files ?? []).map(async (file) => {
        if (file.target?.startsWith("~/") === true) {
          await rm(path.join(cwd, file.target.slice(2)), { force: true });
        }
      })
    )
  );
  await rm(path.join(cwd, "chatjs/plugins"), { force: true, recursive: true });
  await syncPlugins(cwd);
};

export {
  initializePluginUi,
  planPluginRegistrations,
  pluginRegistrationTargets,
  syncPlugins,
};
