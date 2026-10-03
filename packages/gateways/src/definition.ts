import { z } from "zod";

const MAX_CONCURRENT_RESEARCH_UNITS = 20;
const MAX_RESEARCHER_ITERATIONS = 10;
const MAX_SEARCH_QUERIES = 10;
const GATEWAY_CONTRACT_VERSION = 1;

/* oxlint-disable eslint/no-magic-numbers -- A model ID must contain at least one character; the nonempty-string bound is clearer at the schema operation. */
const model = z.string().min(1);
/* oxlint-enable eslint/no-magic-numbers */
const toggle = z.object({ enabled: z.boolean() });
const media = z.object({ default: model.optional() });

/* oxlint-disable eslint/no-magic-numbers -- Research counts must be positive and environment alternatives must be nonempty; retain their minimum of one inline beside each validation. */
/* oxlint-disable unicorn/max-nested-calls -- Keep this data transformation together so its argument evaluation order and contextual type inference remain explicit. */
/* oxlint-disable eslint/no-undefined -- Undefined represents an omitted optional argument or absent value in the existing TypeScript/SDK contract. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
/** Serializable installation contract. Adapter behavior is checked by TypeScript and contract tests. */
const gatewayDefinitionSchema = z
  .object({
    capabilities: z.object({ image: z.boolean(), video: z.boolean() }),
    contractVersion: z.literal(GATEWAY_CONTRACT_VERSION),
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
          maxConcurrentResearchUnits: z
            .number()
            .int()
            .min(1)
            .max(MAX_CONCURRENT_RESEARCH_UNITS),
          maxResearcherIterations: z
            .number()
            .int()
            .min(1)
            .max(MAX_RESEARCHER_ITERATIONS),
          maxSearchQueries: z.number().int().min(1).max(MAX_SEARCH_QUERIES),
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

type GatewayDefinition = z.infer<typeof gatewayDefinitionSchema>;

export { gatewayDefinitionSchema };

export type { GatewayDefinition };
