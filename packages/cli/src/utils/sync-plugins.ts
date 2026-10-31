import { assertUiCompatibility } from "./ui-compatibility";
import { writeGeneratedFiles } from "./write-generated-files";
import { assertCurrentInstallationLayout } from "./installation-layout";
import { rm } from "node:fs/promises";
import path from "node:path";
import type { PluginDefinition } from "../../../registry/metadata";
import { readInstalledPlugins } from "./installed-plugins";
import { planDatabaseSchemas } from "./sync-database";
import { generatedRegistrationSource } from "./generated-registration-source";
import { initializeObservability } from "./sync-observability";
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
  const routers = new Set(["eve"]);
  const controls = new Set([
    "canvas",
    "web-search",
    "deep-research",
    "image",
    "video",
  ]);
  const settings = new Set(["general"]);
  const exclusive = new Set<string>();
  for (const plugin of plugins) {
    for (const [keys, seen, label] of [
      [plugin.server?.routers ?? [], routers, "router"],
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

const imports = (
  selected: readonly PluginDefinition[],
  side: "server" | "client"
): string =>
  selected
    .map(
      (plugin, index) =>
        `import { ${plugin[side]?.export} as plugin${index} } from "@/chatjs/plugins/${plugin.id}/${side}-plugin";`
    )
    .join("\n");

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
  const routerPlugins = plugins.filter(
    (plugin) => (plugin.server?.routers.length ?? 0) > 0
  );
  const instrumented = plugins.filter(
    (plugin) => plugin.server?.instrumentation
  );
  const layout = plugins.filter((plugin) => plugin.client?.layout);
  const uploads = plugins.filter((plugin) => plugin.client?.uploads);
  const modelVisibility = plugins.filter(
    (plugin) => plugin.client?.modelVisibility
  );
  const chat = plugins.filter((plugin) => plugin.chat);
  const chatUi = plugins.filter(
    ({ client }) =>
      client !== undefined &&
      (client.layout !== true ||
        client.chat === true ||
        client.accountSummary === true ||
        client.composerControls.length > 0 ||
        client.settingsItems.length > 0)
  );
  const signedOut = plugins.find((plugin) => plugin.signedOut);
  const profiles = plugins.filter((plugin) => plugin.sessionProfile);
  const cleanup = plugins.filter((plugin) => plugin.cleanup);
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
      `${profiles.map((plugin, index) => `import { ${plugin.sessionProfile?.export} as profile${index} } from "@/chatjs/plugins/${plugin.id}/session-profile";`).join("\n")}
import type { SessionProfile } from "@/chatjs/core/session/contracts";
${profiles.map((plugin, index) => `if (profile${index}.authenticator !== ${JSON.stringify(plugin.sessionProfile?.authenticator)}) throw new Error("Session profile identity disagrees with its descriptor.");`).join("\n")}
export const installedSessionProfiles: readonly SessionProfile[] = [${profiles.map((_, index) => `profile${index}`).join(", ")}];`,
    ],
    [
      "installed-cleanup",
      `${cleanup.map((plugin, index) => `import { ${plugin.cleanup?.export} as cleanup${index} } from "@/chatjs/plugins/${plugin.id}/cleanup";`).join("\n")}
import type { CleanupTask } from "@/lib/cleanup/contracts";
${cleanup.map((plugin, index) => `if (cleanup${index}.id !== ${JSON.stringify(plugin.cleanup?.id)}) throw new Error("Cleanup identity disagrees with its descriptor.");`).join("\n")}
export const installedCleanupTasks: readonly CleanupTask[] = [${cleanup.map((_, index) => `cleanup${index}`).join(", ")}];`,
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
      `${imports(modelVisibility, "client")}\nimport type { ModelVisibility } from "@/chatjs/core/installation/contracts";\nexport const installedModelVisibility: readonly ModelVisibility[] = [${modelVisibility.length > 0 ? "plugin0.useModelVisibility" : ""}];`,
    ],
    [
      "installed-chat",
      `${chat.map((plugin, index) => `import { ${plugin.chat?.export} as chat${index} } from "@/chatjs/plugins/${plugin.id}/chat";`).join("\n")}\nimport type { ChatServerIntegration } from "@/chatjs/core/chat/contracts";\nexport const installedChat: readonly ChatServerIntegration[] = [${chat.map((_, index) => `chat${index}`).join(", ")}];`,
    ],
    [
      "installed-chat-ui",
      `"use client";\n${imports(chatUi, "client")}\nimport type { UiPlugin } from "@/chatjs/core/ui/slots";\nexport const installedChatPlugins: readonly UiPlugin[] = [${chatUi.map((_, index) => `plugin${index}`).join(", ")}];`,
    ],
    [
      "installed",
      `export const installedPlugins: ReadonlySet<string> = new Set(${plugins.length > 0 ? JSON.stringify(plugins.map((plugin) => plugin.id)) : ""});`,
    ],
    [
      "installed-routers",
      `${imports(routerPlugins, "server")}\nimport type { InstalledRouters } from "@/chatjs/core/installation/contracts";\nexport const installedRouters = { ${routerPlugins.flatMap((plugin, index) => plugin.server?.routers.map((key) => `${key}: plugin${index}().routers.${key}`) ?? []).join(", ")} } satisfies InstalledRouters;`,
    ],
    [
      "installed-instrumentation",
      `${imports(instrumented, "server")}\nimport type { InstrumentationRegistration } from "@/chatjs/core/installation/contracts";\nexport const installedInstrumentation: readonly InstrumentationRegistration[] = [${instrumented.map((_, index) => `plugin${index}().instrumentation`).join(", ")}];`,
    ],
    [
      "installed-layout",
      `"use client";\n${imports(layout, "client")}\nimport type { UiPlugin } from "@/chatjs/core/ui/slots";\nexport const installedLayoutPlugins: readonly UiPlugin[] = [${layout.map((_, index) => `plugin${index}`).join(", ")}];`,
    ],
    [
      "installed-uploads",
      `${imports(uploads, "client")}\nimport type { AttachmentUploadIntegration } from "@/chatjs/core/installation/contracts";\nexport const installedUploads: readonly AttachmentUploadIntegration[] = [${uploads.length > 0 ? "plugin0.uploads" : ""}];`,
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
  await initializeObservability(cwd);
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
