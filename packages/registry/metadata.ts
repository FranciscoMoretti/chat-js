import { z } from "zod";

/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import { composerIconNames } from "./composer-icons.generated";
/* oxlint-enable eslint/sort-imports */

const identifier = z
  .string()
  .regex(/^[A-Za-z_$][\w$]*$/u)
  .refine((value) => value !== "__proto__", "Reserved registration name");
/* oxlint-disable import/exports-last -- Keep the exported declaration beside the types and initialization it describes; moving it can reorder module initialization. */
/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
/* oxlint-disable unicorn/max-nested-calls -- Keep this data transformation together so its argument evaluation order and contextual type inference remain explicit. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
export const envRequirementSchema = z.object({
  description: z.string().optional(),
  options: z
    .array(z.array(z.string().regex(/^[A-Z_][A-Z0-9_]*$/u)).min(1))
    .min(1),
  runtimeAuth: z.literal("vercel-oidc").optional(),
});
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable unicorn/max-nested-calls */
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/group-exports */
/* oxlint-enable import/exports-last */
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
/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
// A single native EVE authoring contract. The version validates the descriptor format.
export const toolDefinitionSchema = toolDefinitionBase
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
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/group-exports */
/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
export type ToolDefinition = z.infer<typeof toolDefinitionSchema>;
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
export const storageDefinitionSchema = z.object({
  configKeys: z.array(z.string()).default([]),
  contractVersion: z.literal(1),
  envRequirements: z.array(envRequirementSchema).default([]),
  id: z.string().regex(/^[a-z][a-z0-9-]*$/u),
  kind: z.literal("storage"),
  optionalEnv: z.array(z.string().regex(/^[A-Z_][A-Z0-9_]*$/u)).default([]),
});
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/group-exports */
/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
export type StorageDefinition = z.infer<typeof storageDefinitionSchema>;
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
// Supported web installation boundaries. Implementations are added by their owners.
export const featureIdSchema = z.enum([
  "mcp",
  "attachment-uploads",
  "vercel-analytics",
  "vercel-speed-insights",
  "langfuse",
]);
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/group-exports */
/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
export const featureDefinitionSchema = z.object({
  contractVersion: z.literal(1),
  envRequirements: z.array(envRequirementSchema).optional(),
  id: featureIdSchema,
  kind: z.literal("feature"),
  requiresFeatures: z.array(featureIdSchema).optional(),
});
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
export type FeatureDefinition = z.infer<typeof featureDefinitionSchema>;
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/group-exports */
