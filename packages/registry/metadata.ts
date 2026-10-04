import { z } from "zod";

import { composerIconNames } from "./composer-icons.generated";

const identifier = z
  .string()
  .regex(/^[A-Za-z_$][\w$]*$/u)
  .refine((value) => value !== "__proto__", "Reserved registration name");

/* oxlint-disable unicorn/max-nested-calls -- Keep this data transformation together so its argument evaluation order and contextual type inference remain explicit. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
const envRequirementSchema = z.object({
  description: z.string().optional(),
  options: z
    .array(z.array(z.string().regex(/^[A-Z_][A-Z0-9_]*$/u)).min(1))
    .min(1),
  runtimeAuth: z.literal("vercel-oidc").optional(),
});
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable unicorn/max-nested-calls */

/* oxlint-disable unicorn/max-nested-calls -- Keep this data transformation together so its argument evaluation order and contextual type inference remain explicit. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
const toolDefinitionBase = z.object({
  availabilityExport: identifier.optional(),
  codeExecutorExport: identifier.optional(),
  documentKind: z.enum(["text", "code", "sheet"]).optional(),
  documentRunExport: identifier.optional(),
  envRequirements: z.array(envRequirementSchema).default([]),
  id: z.string().regex(/^[a-z][a-z0-9-]*$/u),
  kind: z.literal("tool"),
  requiresGateway: z.array(z.enum(["image", "video"])).optional(),
  requiresStorage: z.literal(true).optional(),
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
  tools: z
    .array(
      z.object({
        composer: z
          .object({
            icon: identifier.refine(
              (name) => composerIconNames.has(name),
              "Unknown Lucide icon export"
            ),
            name: z.string().min(1),
            shortName: z.string().min(1),
          })
          .optional(),
        rendererExport: identifier.optional(),
        toolExport: identifier,
        workflow: z.literal(true).optional(),
      })
    )
    .min(1),
});
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable unicorn/max-nested-calls */

/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
// A single native EVE authoring contract. The version validates the descriptor format.
const toolDefinitionSchema = toolDefinitionBase
  .extend({
    contractVersion: z.literal(1),
  })
  .refine(
    (item) =>
      !(
        typeof item.codeExecutorExport === "string" &&
        item.codeExecutorExport !== ""
      ) || item.slot === "codeExecution",
    {
      message:
        "Code executor capabilities apply only to a codeExecution provider",
    }
  )
  .refine((item) => !item.slot || item.tools.every((tool) => !tool.workflow), {
    message: "Provider slots require ordinary native tools",
  })
  .refine((item) => !item.slot || item.tools.length === 1, {
    message: "A provider slot must register exactly one tool",
  });
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-magic-numbers */

type ToolDefinition = z.infer<typeof toolDefinitionSchema>;

/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
const storageDefinitionSchema = z.object({
  configKeys: z.array(z.string()).default([]),
  contractVersion: z.literal(1),
  envRequirements: z.array(envRequirementSchema).default([]),
  id: z.string().regex(/^[a-z][a-z0-9-]*$/u),
  kind: z.literal("storage"),
  optionalEnv: z.array(z.string().regex(/^[A-Z_][A-Z0-9_]*$/u)).default([]),
});
/* oxlint-enable eslint/no-magic-numbers */

type StorageDefinition = z.infer<typeof storageDefinitionSchema>;

// Supported web installation boundaries. Implementations are added by their owners.
const featureIdSchema = z.enum([
  "mcp",
  "attachment-uploads",
  "vercel-analytics",
  "vercel-speed-insights",
  "langfuse",
]);

/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
const featureDefinitionSchema = z.object({
  contractVersion: z.literal(1),
  envRequirements: z.array(envRequirementSchema).optional(),
  id: featureIdSchema,
  kind: z.literal("feature"),
  requiresFeatures: z.array(featureIdSchema).optional(),
  requiresStorage: z.literal(true).optional(),
});
/* oxlint-enable eslint/no-magic-numbers */

type FeatureDefinition = z.infer<typeof featureDefinitionSchema>;
export {
  envRequirementSchema,
  featureDefinitionSchema,
  featureIdSchema,
  storageDefinitionSchema,
  toolDefinitionSchema,
};
export type { FeatureDefinition, StorageDefinition, ToolDefinition };
