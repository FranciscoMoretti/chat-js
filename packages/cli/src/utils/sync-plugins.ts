import { hasPluginEntry } from "../../../registry/plugin-entry";
import { assertUiCompatibility } from "./ui-compatibility";
import { writeGeneratedFiles } from "./write-generated-files";
import { assertCurrentInstallationLayout } from "./installation-layout";
import { rm } from "node:fs/promises";
import path from "node:path";
import type { PluginDefinition } from "../../../registry/metadata";
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

const assertUniqueAuthenticators = (
  plugins: readonly PluginDefinition[]
): void => {
  const authenticators = new Set(["chatjs-gateway"]);
  for (const { sessionAuthenticator } of plugins) {
    if (sessionAuthenticator === undefined) {
      continue;
    }
    if (authenticators.has(sessionAuthenticator)) {
      throw new Error(
        `Duplicate or reserved plugin identity: ${sessionAuthenticator}`
      );
    }
    authenticators.add(sessionAuthenticator);
  }
};

const assertUniqueContributions = (
  plugins: readonly PluginDefinition[]
): void => {
  const exclusive = new Set<string>();
  for (const plugin of plugins) {
    for (const [present, label] of [
      [hasPluginEntry(plugin, "signed-out.tsx"), "the signed-out screen"],
      [hasPluginEntry(plugin, "auth-server.ts"), "authentication"],
      [
        hasPluginEntry(plugin, "auth-form.tsx") ||
          hasPluginEntry(plugin, "sign-out.ts"),
        "authentication UI",
      ],
      [hasPluginEntry(plugin, "navigation.ts"), "modified navigation"],
      [hasPluginEntry(plugin, "billing.ts"), "usage billing"],
      [hasPluginEntry(plugin, "model-visibility.ts"), "model visibility"],
      [hasPluginEntry(plugin, "uploads.ts"), "attachment uploads"],
    ] as const) {
      if (!present) {
        continue;
      }
      if (exclusive.has(label)) {
        throw new Error(`Only one plugin may supply ${label}.`);
      }
      exclusive.add(label);
    }
  }
  assertPluginDependencies(plugins);
  assertUniqueAuthenticators(plugins);
};

const imports = (entries: readonly { readonly source: string }[]): string =>
  entries.map(({ source }) => source).join("\n");

const pluginTitle = (id: string): string =>
  id
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");

const defaultEntries = (
  plugins: readonly PluginDefinition[],
  file: string,
  suffix: string,
  reserved: string,
  enabled = (plugin: PluginDefinition) => hasPluginEntry(plugin, file)
) => {
  const moduleName = path.basename(file, path.extname(file));
  const entries = plugins.filter(enabled);
  const bindings = pluginBindings(
    entries.map((plugin) => {
      const { id } = plugin;
      const title = pluginTitle(id);
      return {
        id,
        plugin,
        preferred: title.charAt(0).toLowerCase() + title.slice(1) + suffix,
      };
    }),
    [reserved]
  );
  return bindings.map(({ id, name, plugin }) => ({
    plugin,
    name,
    source: `import ${name} from "@/chatjs/plugins/${id}/${moduleName}";`,
  }));
};

const fileEntries = (
  plugins: readonly PluginDefinition[],
  entry: string,
  exported: string,
  suffix?: string
) => {
  const bindings = pluginBindings(
    plugins
      .filter((plugin) => hasPluginEntry(plugin, `${entry}.ts`))
      .map(({ id }) => {
        const title = pluginTitle(id);
        return {
          id,
          preferred:
            suffix === undefined
              ? exported
              : title.charAt(0).toLowerCase() + title.slice(1) + suffix,
        };
      }),
    []
  );
  return bindings.map(({ id, name }) => ({
    name,
    source: `import { ${exported === name ? name : `${exported} as ${name}`} } from "@/chatjs/plugins/${id}/${entry}";`,
  }));
};

const renderRouters = (plugins: readonly PluginDefinition[]): string => {
  const routers = fileEntries(plugins, "router", "router", "Router");
  return `${imports(routers)}
export const installedRouters = [${routers.map(({ name }) => name).join(", ")}] as const;`;
};

const renderInstrumentation = (
  plugins: readonly PluginDefinition[]
): string => {
  const entries = plugins.filter((plugin) =>
    hasPluginEntry(plugin, "instrumentation.ts")
  );
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

const renderPluginRegistrations = (
  plugins: readonly PluginDefinition[],
  databaseSchemas: string
): Map<string, string> => {
  const entries = (file: string, suffix: string, reserved: string) =>
    defaultEntries(plugins, file, suffix, reserved);
  const layout = fileEntries(plugins, "layout-ui", "layoutUi", "Layout");
  const uploads = fileEntries(plugins, "uploads", "attachmentUploads");
  const modelVisibility = fileEntries(
    plugins,
    "model-visibility",
    "useModelVisibility"
  );
  const chat = entries("chat.ts", "Chat", "installedChat");
  const chatUi = fileEntries(plugins, "chat-ui", "chatUi", "Client");
  const signedOut = entries(
    "signed-out.tsx",
    "Screen",
    "installedSignedOutScreens"
  );
  const profiles = defaultEntries(
    plugins,
    "session-profile.ts",
    "Profile",
    "installedSessionProfiles",
    (plugin) => plugin.sessionAuthenticator !== undefined
  );
  const cleanup = entries("cleanup.ts", "Cleanup", "installedCleanupTasks");
  const authentication = entries("auth-server.ts", "Auth", "installedAuth");
  const forms = entries(
    "auth-form.tsx",
    "Form",
    "installedAuthenticationForms"
  );
  const signOut = entries("sign-out.ts", "SignOut", "installedSignOutHandlers");
  const navigation = entries(
    "navigation.ts",
    "Navigation",
    "installedNavigationHandlers"
  );
  const billing = entries("billing.ts", "Billing", "installedBilling");
  const contents = [
    [
      "installed-signed-out",
      `${imports(signedOut)}
import type { ComponentType } from "react";
export const installedSignedOutScreens: readonly ComponentType[] = [${signedOut.map(({ name }) => name).join(", ")}];`,
    ],
    [
      "installed-session-profiles",
      `${imports(profiles)}
import type { SessionProfile } from "@/chatjs/core/session/contracts";
${profiles.map(({ plugin, name }) => `if (${name}.authenticator !== ${JSON.stringify(plugin.sessionAuthenticator)}) throw new Error("Session profile identity disagrees with its descriptor.");`).join("\n")}
export const installedSessionProfiles: readonly SessionProfile[] = [${profiles.map(({ name }) => name).join(", ")}];`,
    ],
    [
      "installed-cleanup",
      `${imports(cleanup)}
import type { CleanupTask } from "@/lib/cleanup/contracts";
export const installedCleanupTasks: readonly CleanupTask[] = [${cleanup.map(({ plugin, name }) => `{ id: ${JSON.stringify(plugin.id)}, run: ${name} }`).join(", ")}];`,
    ],
    [
      "installed-auth",
      `${imports(authentication)}
import type { AuthenticationIntegration } from "@/chatjs/core/authentication/contracts";
export const installedAuth: readonly AuthenticationIntegration[] = [${authentication.map(({ name }) => name).join(", ")}];`,
    ],
    [
      "installed-auth-ui",
      `${imports(forms)}
import type { AuthenticationUi } from "@/chatjs/core/authentication/contracts";
export const installedAuthenticationForms: readonly AuthenticationUi["Form"][] = [${forms.map(({ name }) => name).join(", ")}];`,
    ],
    [
      "installed-sign-out",
      `${imports(signOut)}
import type { AuthenticationUi } from "@/chatjs/core/authentication/contracts";
export const installedSignOutHandlers: readonly AuthenticationUi["signOut"][] = [${signOut.map(({ name }) => name).join(", ")}];`,
    ],
    [
      "installed-navigation",
      `${imports(navigation)}
export const installedNavigationHandlers: readonly (() => boolean)[] = [${navigation.map(({ name }) => name).join(", ")}];`,
    ],
    [
      "installed-billing",
      `${imports(billing)}
import type { UsageBilling } from "@/chatjs/core/billing/contracts";
export const installedBilling: readonly UsageBilling[] = [${billing.map(({ name }) => name).join(", ")}];`,
    ],
    [
      "installed-model-visibility",
      `${imports(modelVisibility)}\nimport type { ModelVisibility } from "@/chatjs/core/installation/contracts";\nexport const installedModelVisibility: readonly ModelVisibility[] = [${modelVisibility.map(({ name }) => name).join(", ")}];`,
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
      `${imports(uploads)}\nimport type { AttachmentUploadIntegration } from "@/chatjs/core/installation/contracts";\nexport const installedUploads: readonly AttachmentUploadIntegration[] = [${uploads.map(({ name }) => name).join(", ")}];`,
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
        `Missing plugin descriptor: chatjs/plugins/${id}/plugin.json`
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
      item.files.map(async (file) => {
        await rm(path.join(cwd, file.target.slice(2)), { force: true });
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
