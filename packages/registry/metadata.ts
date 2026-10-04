import { z } from "zod";

import { composerIconNames } from "./composer-icons.generated";

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
  toolExport: identifier,
  workflow: z.literal(true).optional(),
});

const toolDefinitionBase = z.object({
  availabilityExport: identifier.optional(),
  codeExecutorExport: identifier.optional(),
  documentKind: z.enum(["text", "code", "sheet"]).optional(),
  documentRunExport: identifier.optional(),
  envRequirements: z.array(envRequirementSchema).default([]),
  id: z.string().regex(/^[a-z][a-z0-9-]*$/u),
  kind: z.literal("tool"),
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
    contractVersion: z.literal(CONTRACT_VERSION),
  })
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

// Supported web installation boundaries. Implementations are added by their owners.
const featureIdSchema = z.enum([
  "mcp",
  "attachment-uploads",
  "vercel-analytics",
  "vercel-speed-insights",
  "langfuse",
]);

const featureDefinitionSchema = z.object({
  contractVersion: z.literal(CONTRACT_VERSION),
  envRequirements: z.array(envRequirementSchema).optional(),
  id: featureIdSchema,
  kind: z.literal("feature"),
  requiresFeatures: z.array(featureIdSchema).optional(),
});

type FeatureDefinition = z.infer<typeof featureDefinitionSchema>;
export {
  envRequirementSchema,
  featureDefinitionSchema,
  featureIdSchema,
  storageDefinitionSchema,
  toolDefinitionSchema,
};
export type { FeatureDefinition, StorageDefinition, ToolDefinition };
