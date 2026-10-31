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
  composer: composerSchema.optional(),
  rendererExport: identifier.optional(),
  definitionExport: identifier.optional(),
  toolExport: identifier,
  workflow: z.literal(true).optional(),
});

const executionCapabilities = z.object({
  cancellation: z.literal("terminate"),
  cleanup: z.literal("durable-allocation"),
  files: z.literal("ephemeral"),
  languages: z
    .array(z.enum(["python", "javascript"]))
    .refine(
      (languages: readonly string[]) =>
        languages.includes("python") && languages.includes("javascript"),
      "Code execution requires Python and JavaScript"
    ),
  timeout: z.literal("bounded"),
  usage: z.literal("single-receipt"),
});

const toolDefinitionBase = z.object({
  config: z.object({ key: identifier }).optional(),
  availabilityExport: identifier.optional(),
  codeExecutionCapabilities: executionCapabilities.optional(),
  codeExecutorExport: identifier.optional(),
  documentKind: z
    .string()
    .regex(/^[a-z][a-z0-9-]*$/u)
    .max(100)
    .optional(),
  documentRunExport: identifier.optional(),
  envRequirements: z.array(envRequirementSchema).default([]),
  id: z.string().regex(/^[a-z][a-z0-9-]*$/u),
  kind: z.literal("tool"),
  requiresGateway: z.array(z.enum(["image", "video"])).optional(),
  requiresStorage: z.literal(true).optional(),
  requiresPersistentSandbox: z.literal(true).optional(),
  requiresSandbox: z.literal(true).optional(),
  requiresTools: z.array(identifier).default([]),
  slot: z
    .enum([
      "webSearch",
      "codeExecution",
      "retrieveUrl",
      "generateImage",
      "generateVideo",
    ])
    .optional(),
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
    (item: Readonly<{ codeExecutorExport?: string; slot?: string }>) =>
      !(
        typeof item.codeExecutorExport === "string" &&
        item.codeExecutorExport !== ""
      ) || item.slot === "codeExecution",
    {
      message:
        "Code executor capabilities apply only to a codeExecution provider",
    }
  )
  .refine(
    (item: Readonly<{ codeExecutionCapabilities?: unknown; slot?: string }>) =>
      typeof item.codeExecutionCapabilities !== "object" ||
      item.slot === "codeExecution",
    { message: "Code execution capabilities require a codeExecution provider" }
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
const pluginModuleSchema = z.string().regex(/^[a-zA-Z0-9_-]+\.(?:ts|js|mjs)$/u);
const pluginDefinitionBase = z.object({
  id: pluginIdSchema,
  kind: z.literal("plugin"),
  files: z.array(z.string().min(1)).default([]),
  environmentValidation: pluginModuleSchema.optional(),
  databaseSchemas: z
    .array(z.string().regex(/^(?:[a-zA-Z0-9_-]+\/)+[a-zA-Z0-9_-]+\.ts$/u))
    .optional(),
  envRequirements: z.array(envRequirementSchema).optional(),
  requiresPlugins: z.array(pluginIdSchema).optional(),
  requiresStorage: z.literal(true).optional(),
  requiresPersistentSandbox: z.literal(true).optional(),
  chat: z.object({ export: identifier }).optional(),
  billing: z.object({ export: identifier }).optional(),
  signedOut: z.object({ export: identifier }).optional(),
  sessionProfile: z
    .object({ export: identifier, authenticator: z.string().min(1) })
    .optional(),
  cleanup: z.object({ export: identifier, id: pluginIdSchema }).optional(),
  authentication: z.object({ export: identifier }).optional(),
  authenticationUi: z
    .object({ form: identifier, signOut: identifier })
    .optional(),
  navigation: z.object({ export: identifier }).optional(),
  server: z
    .object({
      export: identifier,
      routers: z.array(identifier).default([]),
      instrumentation: z.literal(true).optional(),
    })
    .optional(),
  client: z
    .object({
      export: identifier,
      composerControls: z.array(pluginIdSchema).default([]),
      settingsItems: z.array(pluginIdSchema).default([]),
      chat: z.literal(true).optional(),
      layout: z.literal(true).optional(),
      accountSummary: z.literal(true).optional(),
      uploads: z.literal(true).optional(),
      modelVisibility: z.literal(true).optional(),
    })
    .optional(),
});

// Version 2 explicitly identifies the native UI host. A CLI that only supports
// Base rejects Radix descriptors before installing source; v1 stays readable.
const pluginDefinitionSchema = z.discriminatedUnion("contractVersion", [
  pluginDefinitionBase.extend({
    contractVersion: z.literal(1),
    uiBase: z.never().optional(),
  }),
  pluginDefinitionBase.extend({
    contractVersion: z.literal(2),
    uiBase: z.enum(["base", "radix"]),
  }),
]);

type PluginDefinition = z.infer<typeof pluginDefinitionSchema>;
export {
  envRequirementSchema,
  pluginDefinitionSchema,
  pluginIdSchema,
  storageDefinitionSchema,
  toolDefinitionSchema,
};
export type { PluginDefinition, StorageDefinition, ToolDefinition };
