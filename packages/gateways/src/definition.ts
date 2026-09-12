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
      workflows: z.object({
        chat: model,
        title: model,
        pdf: model,
        chatImageCompatible: model,
      }),
      tools: z.object({
        webSearch: toggle,
        urlRetrieval: toggle,
        codeExecution: toggle,
        mcp: toggle,
        documents: toggle.extend({
          types: z.object({
            text: z.boolean(),
            code: z.boolean(),
            sheet: z.boolean(),
          }),
        }),
        followupSuggestions: toggle.extend({ default: model }),
        text: z.object({ polish: model }),
        sheet: z.object({ format: model, analyze: model }),
        code: z.object({ edits: model }),
        image: media,
        video: media,
        deepResearch: toggle.extend({
          defaultModel: model,
          finalReportModel: model,
          allowClarification: z.boolean(),
          maxResearcherIterations: z.number().int().min(1).max(10),
          maxConcurrentResearchUnits: z.number().int().min(1).max(20),
          maxSearchQueries: z.number().int().min(1).max(10),
        }),
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
