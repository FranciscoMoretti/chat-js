import { z } from "zod";

/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
const model = z.string().min(1);
/* oxlint-enable eslint/no-magic-numbers */
const toggle = z.object({ enabled: z.boolean() });
const media = z.object({ default: model.optional() });

/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/* oxlint-disable unicorn/max-nested-calls -- Keep this data transformation together so its argument evaluation order and contextual type inference remain explicit. */
/* oxlint-disable eslint/no-undefined -- Undefined represents an omitted optional argument or absent value in the existing TypeScript/SDK contract. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
/** Serializable installation contract. Adapter behavior is checked by TypeScript and contract tests. */
export const gatewayDefinitionSchema = z
  .object({
    capabilities: z.object({ image: z.boolean(), video: z.boolean() }),
    contractVersion: z.literal(1),
    defaults: z.object({
      anonymousModels: z.array(model),
      curatedDefaults: z.array(model),
      disabledModels: z.array(model),
      providerOrder: z.array(z.string()),
      tools: z.object({
        code: z.object({ edits: model }),
        deepResearch: z.object({
          allowClarification: z.boolean(),
          defaultModel: model,
          finalReportModel: model,
          maxConcurrentResearchUnits: z.number().int().min(1).max(20),
          maxResearcherIterations: z.number().int().min(1).max(10),
          maxSearchQueries: z.number().int().min(1).max(10),
        }),
        followupSuggestions: toggle.extend({ default: model }),
        image: media,
        sheet: z.object({ analyze: model, format: model }),
        text: z.object({ polish: model }),
        video: media,
      }),
      workflows: z.object({
        chat: model,
        chatImageCompatible: model,
        pdf: model,
        title: model,
      }),
    }),
    envRequirements: z.array(
      z.object({
        description: z.string().optional(),
        options: z
          .array(z.array(z.string().regex(/^[A-Z_][A-Z0-9_]*$/u)).min(1))
          .min(1),
      })
    ),
    id: z.string().regex(/^[a-z][a-z0-9-]*$/u),
    kind: z.literal("gateway"),
    optionalEnv: z.array(z.string().regex(/^[A-Z_][A-Z0-9_]*$/u)).default([]),
  })
  .superRefine((definition, ctx) => {
    for (const kind of ["image", "video"] as const) {
      if (
        definition.defaults.tools[kind].default !== undefined &&
        !definition.capabilities[kind]
      ) {
        ctx.addIssue({
          code: "custom",
          message: `Gateway does not support ${kind} generation.`,
          path: ["defaults", "tools", kind],
        });
      }
    }
  });
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-undefined */
/* oxlint-enable unicorn/max-nested-calls */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable import/no-named-export */

/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
export type GatewayDefinition = z.infer<typeof gatewayDefinitionSchema>;
/* oxlint-enable import/no-named-export */
