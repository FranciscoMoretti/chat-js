import { z } from "zod";

const model = z.string().min(1);
const toggle = z.object({ enabled: z.boolean() });
const media = z.discriminatedUnion("enabled", [
  z.object({ default: model, enabled: z.literal(true) }),
  z.object({ default: model.optional(), enabled: z.literal(false) }),
]);

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
        codeExecution: toggle,
        deepResearch: toggle.extend({
          allowClarification: z.boolean(),
          defaultModel: model,
          finalReportModel: model,
          maxConcurrentResearchUnits: z.number().int().min(1).max(20),
          maxResearcherIterations: z.number().int().min(1).max(10),
          maxSearchQueries: z.number().int().min(1).max(10),
        }),
        documents: toggle.extend({
          types: z.object({
            code: z.boolean(),
            sheet: z.boolean(),
            text: z.boolean(),
          }),
        }),
        followupSuggestions: toggle.extend({ default: model }),
        image: media,
        mcp: toggle,
        sheet: z.object({ analyze: model, format: model }),
        text: z.object({ polish: model }),
        urlRetrieval: toggle,
        video: media,
        webSearch: toggle,
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
        (definition.defaults.tools[kind].enabled ||
          definition.defaults.tools[kind].default !== undefined) &&
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

export type GatewayDefinition = z.infer<typeof gatewayDefinitionSchema>;
