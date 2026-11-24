import { composerIconNames } from "./composer-icons.generated";
import { z } from "zod";

const CONTRACT_VERSION = 1;
const REQUIRED_ITEM_COUNT = 1;
const PROVIDER_TOOL_COUNT = 1;

const identifier = z
  .string()
  .regex(/^[A-Za-z_$][\w$]*$/u)
  .refine((value) => value !== "__proto__", "Reserved registration name");

const environmentVariable = z.string().regex(/^[A-Z_][A-Z0-9_]*$/u);
const environmentAlternative = z
  .array(environmentVariable)
  .min(REQUIRED_ITEM_COUNT);

const envRequirementSchema = z.object({
  description: z.string().optional(),
  options: z.array(environmentAlternative).min(REQUIRED_ITEM_COUNT),
  runtimeAuth: z.literal("vercel-oidc").optional(),
});

const composerSchema = z.object({
  icon: identifier.refine(
    (name) => composerIconNames.has(name),
    "Unknown Lucide icon export"
  ),
  name: z.string().min(REQUIRED_ITEM_COUNT),
  shortName: z.string().min(REQUIRED_ITEM_COUNT),
});

const toolRegistrationSchema = z.object({
  accounting: z
    .union([
      z.enum(["receipt", "none", "unknown"]),
      z.strictObject({ costUsd: z.number().nonnegative() }),
    ])
    .optional(),
  composer: composerSchema.optional(),
  rendererExport: identifier.optional(),
  definitionExport: identifier.optional(),
  toolExport: identifier,
  workflow: z.literal(true).optional(),
});

const toolDefinitionBase = z.object({
  // Builder category is independent of standalone packaging.
  agentCategory: z.enum(["tool", "extension"]).optional(),
  requiresChatJS: z.boolean().optional(),
  channelSupport: z
    .strictObject({
      web: z.enum(["supported", "unverified", "unsupported"]),
      slack: z.enum(["supported", "unverified", "unsupported"]),
    })
    .optional(),
  native: z
    .strictObject({
      layout: z.enum(["tool", "agent"]),
      files: z
        .array(
          z
            .string()
            .regex(/^(?:[a-zA-Z][a-zA-Z0-9-]*\/)*[a-zA-Z][a-zA-Z0-9-]*\.ts$/u)
        )
        .min(1),
      dependencies: z.array(z.string().min(1)),
    })
    .optional(),
  config: z.object({ key: identifier }).optional(),
  availabilityExport: identifier.optional(),
  envRequirements: z.array(envRequirementSchema).default([]),
  id: z.string().regex(/^[a-z][a-z0-9-]*$/u),
  kind: z.literal("tool"),
  requiresGateway: z.array(z.enum(["image", "video"])).optional(),
  requiresStorage: z.literal(true).optional(),
  requiresNativeProcesses: z.literal(true).optional(),
  requiresTools: z.array(identifier).default([]),
  slot: z.enum(["generateImage", "generateVideo"]).optional(),
  tools: z.array(toolRegistrationSchema).min(REQUIRED_ITEM_COUNT),
});

// A single native EVE authoring contract. The version validates the descriptor format.
const toolDefinitionSchema = toolDefinitionBase
  .extend({
    contractVersion: z.union([z.literal(CONTRACT_VERSION), z.literal(2)]),
    uiBase: z.enum(["base", "radix"]).optional(),
  })
  .refine(
    (item) =>
      item.contractVersion === 2
        ? item.uiBase !== undefined
        : item.uiBase === undefined,
    {
      message:
        "UI-specific tools require contractVersion 2 and an explicit uiBase",
    }
  )
  .refine(
    (
      item: Readonly<{
        slot?: string;
        tools: readonly Readonly<{ workflow?: boolean }>[];
      }>
    ) =>
      (item.slot ?? "") === "" ||
      item.tools.every((tool) => tool.workflow !== true),
    { message: "Provider slots require ordinary native tools" }
  )
  .refine(
    (item: Readonly<{ slot?: string; tools: readonly unknown[] }>) =>
      (item.slot ?? "") === "" || item.tools.length === PROVIDER_TOOL_COUNT,
    { message: "A provider slot must register exactly one tool" }
  );

type ToolDefinition = z.infer<typeof toolDefinitionSchema>;

const storageDefinitionSchema = z.object({
  configKeys: z.array(z.string()).default([]),
  contractVersion: z.literal(CONTRACT_VERSION),
  envRequirements: z.array(envRequirementSchema).default([]),
  id: z.string().regex(/^[a-z][a-z0-9-]*$/u),
  kind: z.literal("storage"),
  optionalEnv: z.array(z.string().regex(/^[A-Z_][A-Z0-9_]*$/u)).default([]),
});

type StorageDefinition = z.infer<typeof storageDefinitionSchema>;

// Plugin IDs are open to external registries; contributions use the same contract.
const pluginIdSchema = z.string().regex(/^[a-z][a-z0-9-]*$/u);
const pluginDefinitionSchema = z.strictObject({
  contractVersion: z.literal(3, {
    error:
      "Use plugin contractVersion 3 with file-based router and UI entries. Reinstall the plugin from a matching registry or update its descriptor and source.",
  }),
  uiBase: z.enum(["base", "radix"]).optional(),
  id: pluginIdSchema,
  kind: z.literal("plugin"),
  files: z.array(z.string().min(1)).default([]),
  databaseSchemas: z
    .array(z.string().regex(/^(?:[a-zA-Z0-9_-]+\/)+[a-zA-Z0-9_-]+\.ts$/u))
    .optional(),
  envRequirements: z.array(envRequirementSchema).optional(),
  requiresPlugins: z.array(pluginIdSchema).optional(),
  requiresStorage: z.literal(true).optional(),
  sessionAuthenticator: z.string().min(1).optional(),
});

type PluginDefinition = z.infer<typeof pluginDefinitionSchema>;
export {
  envRequirementSchema,
  pluginDefinitionSchema,
  pluginIdSchema,
  storageDefinitionSchema,
  toolDefinitionSchema,
};
export type { PluginDefinition, StorageDefinition, ToolDefinition };
