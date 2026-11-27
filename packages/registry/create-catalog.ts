import { z } from "zod";
import {
  agentConfigurationSchema,
  eveDefaultToolIds,
} from "./agent-configuration";
import { eveCatalogSource, eveRegistriesSchema } from "./eve-catalog";
import {
  authProviders,
  authSelectionSchema,
  registryAddressSchema,
  storageOptionsSchema,
} from "./installation";
import type { InstallationSelection } from "./installation";
import type { GatewayType } from "./src/gateways/metadata";
import type { SupportedStorageId } from "./src/storage/providers";
import type { InstallationCatalogItem } from "./installation-catalog";
import type { CreateIcon } from "./create-icons";

export const createSections = [
  { value: "appearance", label: "Appearance" },
  { value: "plugins", label: "Plugins" },
  { value: "agent", label: "Agent" },
  { value: "setup", label: "Setup" },
] as const;

type Section = (typeof createSections)[number]["value"];

type RegistryKind = NonNullable<InstallationCatalogItem["definition"]>["kind"];

const addresses = z.array(registryAddressSchema);
const jsonObject = z.string().transform((value, context) => {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    context.addIssue({ code: "custom", message: "Enter a valid JSON object." });
    return z.NEVER;
  }
});
// Bind a parsed value to its serialized field. A schema for an array cannot
// accidentally be attached to a scalar field (or vice versa).
const bind = <
  K extends keyof InstallationSelection,
  S extends z.ZodType<NonNullable<InstallationSelection[NoInfer<K>]>>,
>(
  target: K,
  schema: S
) => ({ target, schema });

interface FieldMetadata {
  section: Section;
  label: string;
  description: string;
  target?: keyof InstallationSelection;
  source?: RegistryKind;
  add?: "flag" | "argument";
  remove?: string;
  icon?: CreateIcon;
  defaultValue?: string;
  menu?: { value: string; label: string };
  help?: string;
}

type Field = FieldMetadata &
  (
    | { kind: "single"; schema: z.ZodType<string> }
    | { kind: "toggle"; schema: z.ZodType<boolean>; pluginId: string }
    | {
        kind: "multiple";
        schema: z.ZodType<readonly string[]>;
        choices?: readonly string[] | typeof eveCatalogSource;
      }
    | { kind: "json"; schema: z.ZodType }
  );

// Public keys also name the CLI flags. Registry-backed choices are discovered at runtime.
export const createCatalog = {
  gateway: {
    add: "flag",
    section: "setup",
    label: "Model gateway",
    menu: { value: "gateway", label: "Models & Gateways" },
    kind: "single",
    source: "gateway",
    description: "Choose how your app connects to AI models.",
    help: "Choose a model gateway by name, registry URL or local JSON path.",
    defaultValue: "vercel" satisfies GatewayType,
    icon: "cpu",
    ...bind("gateway", registryAddressSchema),
  },
  storageProvider: {
    add: "flag",
    section: "setup",
    label: "File storage",
    menu: { value: "infrastructure", label: "Infrastructure" },
    kind: "single",
    source: "storage",
    description: "Choose where attachments and generated files will live.",
    help: "Choose a storage provider by name or registry address.",
    defaultValue: "vercel-blob" satisfies SupportedStorageId,
    icon: "database",
    schema: registryAddressSchema,
  },
  storageConfig: {
    add: "flag",
    section: "setup",
    label: "Storage settings",
    kind: "json",
    description:
      "Public storage options as JSON. Set credentials in the environment.",
    schema: jsonObject.pipe(storageOptionsSchema),
  },
  sandboxProvider: {
    add: "flag",
    section: "agent",
    label: "Sandbox",
    kind: "single",
    source: "sandbox",
    description: "Choose an agent sandbox by name or registry address.",
    defaultValue: "default",
    ...bind("sandbox", registryAddressSchema),
  },
  plugin: {
    add: "flag",
    remove: "Remove an installed plugin by ID.",
    section: "plugins",
    label: "Plugins",
    source: "plugin",
    kind: "multiple",
    description: "Install an app plugin by name or registry address.",
    ...bind("plugins", addresses),
  },
  tool: {
    add: "argument",
    section: "agent",
    label: "ChatJS tools",
    source: "tool",
    kind: "multiple",
    description: "Install a ChatJS tool by name or registry address.",
    ...bind("tools", addresses),
  },
  eveItem: {
    section: "agent",
    label: "EVE capabilities",
    choices: eveCatalogSource,
    kind: "multiple",
    description: "Add an EVE item ID, named registry item or HTTPS item URL.",
    ...bind("eve", z.array(eveCatalogSource.parseId)),
  },
  eveRegistries: {
    section: "agent",
    label: "EVE registries",
    kind: "json",
    description:
      "Map custom EVE registry namespaces to HTTPS URL templates as JSON.",
    ...bind("eveRegistries", jsonObject.pipe(eveRegistriesSchema)),
  },
  agentConfig: {
    section: "agent",
    label: "Agent configuration",
    kind: "json",
    description:
      "Configure agent models, default tools, reasoning and limits as JSON.",
    ...bind("agent", jsonObject.pipe(agentConfigurationSchema)),
  },
  disabledDefaultTool: {
    section: "agent",
    label: "Default EVE tools",
    kind: "multiple",
    description: "Disable a default EVE tool by ID.",
    schema: z.array(z.enum(eveDefaultToolIds)),
  },
  imageGenerationTool: {
    section: "agent",
    label: "Image generation",
    kind: "single",
    description: "Select an image generation tool by name or registry address.",
    schema: registryAddressSchema,
  },
  videoGenerationTool: {
    section: "agent",
    label: "Video generation",
    kind: "single",
    description: "Select a video generation tool by name or registry address.",
    schema: registryAddressSchema,
  },
  attachments: {
    section: "plugins",
    label: "Attachment uploads",
    kind: "toggle",
    pluginId: "attachment-uploads",
    description: "Enable attachment uploads.",
    schema: z.boolean(),
  },
  electron: {
    section: "setup",
    label: "Electron desktop app",
    menu: { value: "platforms", label: "Platforms" },
    kind: "toggle",
    pluginId: "desktop",
    description: "Include the Electron desktop app.",
    schema: z.boolean(),
  },
  auth: {
    section: "setup",
    label: "Authentication",
    kind: "multiple",
    choices: authProviders,
    menu: { value: "auth", label: "Authentication" },
    description: "Enable a sign-in provider.",
    ...bind("auth", authSelectionSchema),
  },
  mcp: {
    section: "plugins",
    label: "MCP",
    kind: "toggle",
    pluginId: "mcp",
    description: "Install MCP connectors.",
    schema: z.boolean(),
  },
  projects: {
    section: "plugins",
    label: "Projects",
    kind: "toggle",
    pluginId: "projects",
    description: "Include project pages and instructions.",
    schema: z.boolean(),
  },
} as const satisfies Record<string, Field>;

export type CreateFieldKey = keyof typeof createCatalog;
export const createFlag = (key: CreateFieldKey): string =>
  `--${key.replaceAll(/[A-Z]/gu, (letter) => `-${letter.toLowerCase()}`)}`;

export const commonStorageIds: readonly SupportedStorageId[] = [
  "memory",
  "vercel-blob",
  "s3",
  "r2",
];
export const isCommonStorage = (id: string): boolean =>
  commonStorageIds.some((provider) => id === provider);

export const createFieldKeys = Object.keys(createCatalog).filter(
  (key): key is CreateFieldKey => Object.hasOwn(createCatalog, key)
);

type FieldKeysMatching<Shape> = {
  [K in CreateFieldKey]: (typeof createCatalog)[K] extends Shape ? K : never;
}[CreateFieldKey];

export const addFieldKeys = createFieldKeys.filter(
  (key): key is FieldKeysMatching<{ add: string }> =>
    "add" in createCatalog[key]
);
export const addFlagKeys = addFieldKeys.filter(
  (key): key is FieldKeysMatching<{ add: "flag" }> =>
    createCatalog[key].add === "flag"
);
export const addProviderKeys = addFlagKeys.filter(
  (
    key
  ): key is FieldKeysMatching<{
    add: "flag";
    source: RegistryKind;
    kind: "single";
  }> => "source" in createCatalog[key] && createCatalog[key].kind === "single"
);

export const removeFlagKeys = createFieldKeys.filter(
  (key): key is FieldKeysMatching<{ remove: string }> =>
    "remove" in createCatalog[key]
);

export const setupMenu = Object.values(createCatalog).flatMap((field) =>
  field.section === "setup" && "menu" in field ? [field.menu] : []
);

export const registryChoices = (
  catalog: readonly InstallationCatalogItem[],
  kind: RegistryKind,
  value: "id" | "address" = "id"
) =>
  catalog.flatMap(({ definition, name, title, description, icon }) =>
    definition?.kind === kind
      ? [
          {
            value: value === "id" ? definition.id : `@chatjs/${name}`,
            label: title,
            hint: description,
            icon,
          },
        ]
      : []
  );
