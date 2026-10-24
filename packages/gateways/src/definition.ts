import { z } from "zod";

const GATEWAY_CONTRACT_VERSION = 1;
const MIN_REQUIRED_COUNT = 1;
const model = z.string().min(MIN_REQUIRED_COUNT);
const roles = z.object({
  fast: model,
  balanced: model,
  smart: model,
  image: model.optional(),
  video: model.optional(),
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
  roles,
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
    readonly roles: { readonly image?: string; readonly video?: string };
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
          typeof definition.defaults.roles[kind] === "string" &&
          !definition.capabilities[kind]
        ) {
          ctx.addIssue({
            code: "custom",
            message: `Gateway does not support ${kind} generation.`,
            path: ["defaults", "roles", kind],
          });
        }
      }
    }
  );

type GatewayDefinition = z.infer<typeof gatewayDefinitionSchema>;

export { gatewayDefinitionSchema };

export type { GatewayDefinition };
