import { z } from "zod";

const MAX_CONCURRENT_RESEARCH_UNITS = 20;
const MAX_RESEARCHER_ITERATIONS = 10;
const MAX_SEARCH_QUERIES = 10;
const GATEWAY_CONTRACT_VERSION = 1;
const MIN_REQUIRED_COUNT = 1;

const model = z.string().min(MIN_REQUIRED_COUNT);
const toggle = z.object({ enabled: z.boolean() });
const media = z.object({ default: model.optional() });

const deepResearch = z.object({
  allowClarification: z.boolean(),
  defaultModel: model,
  finalReportModel: model,
  maxConcurrentResearchUnits: z
    .number()
    .int()
    .min(MIN_REQUIRED_COUNT)
    .max(MAX_CONCURRENT_RESEARCH_UNITS),
  maxResearcherIterations: z
    .number()
    .int()
    .min(MIN_REQUIRED_COUNT)
    .max(MAX_RESEARCHER_ITERATIONS),
  maxSearchQueries: z
    .number()
    .int()
    .min(MIN_REQUIRED_COUNT)
    .max(MAX_SEARCH_QUERIES),
});
const tools = z.object({
  code: z.object({ edits: model }),
  deepResearch,
  followupSuggestions: toggle.extend({ default: model }),
  image: media,
  sheet: z.object({ analyze: model, format: model }),
  text: z.object({ polish: model }),
  video: media,
});
const workflows = z.object({
  chat: model,
  chatImageCompatible: model,
  pdf: model,
  title: model,
});
const defaults = z.object({
  anonymousModels: z.array(model),
  curatedDefaults: z.array(model),
  disabledModels: z.array(model),
  providerOrder: z.array(z.string()),
  tools,
  workflows,
});
const envName = z.string().regex(/^[A-Z_][A-Z0-9_]*$/u);
const envAlternative = z.array(envName).min(MIN_REQUIRED_COUNT);
const envRequirement = z.object({
  description: z.string().optional(),
  options: z.array(envAlternative).min(MIN_REQUIRED_COUNT),
});

interface CapabilityDefinition {
  readonly capabilities: Readonly<{ image: boolean; video: boolean }>;
  readonly defaults: {
    readonly tools: {
      readonly image: Readonly<{ default?: string }>;
      readonly video: Readonly<{ default?: string }>;
    };
  };
}

/** Serializable installation contract. Adapter behavior is checked by TypeScript and contract tests. */
const gatewayDefinitionSchema = z
  .object({
    capabilities: z.object({ image: z.boolean(), video: z.boolean() }),
    contractVersion: z.literal(GATEWAY_CONTRACT_VERSION),
    defaults,
    envRequirements: z.array(envRequirement),
    id: z.string().regex(/^[a-z][a-z0-9-]*$/u),
    kind: z.literal("gateway"),
    optionalEnv: z.array(envName).default([]),
  })
  .superRefine(
    (
      definition: CapabilityDefinition,
      ctx: Readonly<Pick<z.RefinementCtx, "addIssue">>
    ) => {
      for (const kind of ["image", "video"] as const) {
        if (
          typeof definition.defaults.tools[kind].default === "string" &&
          !definition.capabilities[kind]
        ) {
          ctx.addIssue({
            code: "custom",
            message: `Gateway does not support ${kind} generation.`,
            path: ["defaults", "tools", kind],
          });
        }
      }
    }
  );

type GatewayDefinition = z.infer<typeof gatewayDefinitionSchema>;

export { gatewayDefinitionSchema };

export type { GatewayDefinition };
