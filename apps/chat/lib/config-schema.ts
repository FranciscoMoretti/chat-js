import { z } from "zod";

import type {
  GatewayImageModelIdMap,
  GatewayModelIdMap,
  GatewayType,
  GatewayVideoModelIdMap,
} from "@/lib/ai/gateways/registry";

import { gatewayModelDefaults, gatewayType } from "./ai/gateway-model-defaults";
import type { ToolName } from "./ai/types";

/* oxlint-disable typescript/explicit-function-return-type --
 * typescript/explicit-function-return-type (#560): Keep toolName's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 */
// Helper to create typed model ID schemas
const toolName = () => z.custom<ToolName>();
/* oxlint-enable typescript/explicit-function-return-type */

/* oxlint-disable id-length, typescript/explicit-function-return-type --
 * id-length (#506): gatewayModelId uses G; v as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 * typescript/explicit-function-return-type (#560): Keep gatewayModelId's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 */
// =====================================================
// AI config — discriminated union keyed on gateway
// =====================================================

const gatewayModelId = <G extends GatewayType>() =>
  z.custom<GatewayModelIdMap[G]>((value) => typeof value === "string");
/* oxlint-enable id-length, typescript/explicit-function-return-type */

/* oxlint-disable id-length, typescript/explicit-function-return-type --
 * id-length (#506): gatewayImageModelId uses G; v as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 * typescript/explicit-function-return-type (#560): Keep gatewayImageModelId's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 */
const gatewayImageModelId = <G extends GatewayType>() =>
  z.custom<GatewayImageModelIdMap[G]>((value) => typeof value === "string");
/* oxlint-enable id-length, typescript/explicit-function-return-type */

/* oxlint-disable id-length, typescript/explicit-function-return-type --
 * id-length (#506): gatewayVideoModelId uses G; v as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 * typescript/explicit-function-return-type (#560): Keep gatewayVideoModelId's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 */
const gatewayVideoModelId = <G extends GatewayType>() =>
  z.custom<GatewayVideoModelIdMap[G]>((value) => typeof value === "string");
/* oxlint-enable id-length, typescript/explicit-function-return-type */

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): deepResearchToolConfigSchema uses 1, 20, 10 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 */
const deepResearchToolConfigSchema = z.object({
  allowClarification: z
    .boolean()
    .describe("Whether to ask clarifying questions before starting research"),
  defaultModel: z.string(),
  finalReportModel: z.string(),
  maxConcurrentResearchUnits: z
    .number()
    .int()
    .min(1)
    .max(20)
    .describe("Topics researched in parallel per iteration"),
  maxResearcherIterations: z
    .number()
    .int()
    .min(1)
    .max(10)
    .describe("Maximum supervisor loop iterations"),
  maxSearchQueries: z
    .number()
    .int()
    .min(1)
    .max(10)
    .describe("Max search queries per research topic"),
});
/* oxlint-enable no-magic-numbers */

/* oxlint-disable id-length, max-lines-per-function, typescript/explicit-function-return-type, unicorn/max-nested-calls --
 * id-length (#506): createAiSchema uses G; g as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 * max-lines-per-function (#510): createAiSchema keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * typescript/explicit-function-return-type (#560): Keep createAiSchema's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * unicorn/max-nested-calls (#568): createAiSchema keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 */
const createAiSchema = <G extends GatewayType>(gateway: G) =>
  z.object({
    anonymousModels: z
      .array(gatewayModelId<G>())
      .describe("Models available to anonymous users"),
    curatedDefaults: z
      .array(gatewayModelId<G>())
      .describe("Default models enabled for new users"),
    disabledModels: z
      .array(gatewayModelId<G>())
      .describe("Models to hide from all users"),
    gateway: z.literal(gateway),
    providerOrder: z
      .array(z.string())
      .describe("Provider sort order in model selector"),
    tools: z
      .object({
        code: z.object({
          edits: gatewayModelId<G>(),
        }),
        deepResearch: deepResearchToolConfigSchema.extend({
          defaultModel: gatewayModelId<G>(),
          finalReportModel: gatewayModelId<G>(),
        }),
        followupSuggestions: z.object({
          default: gatewayModelId<G>(),
          enabled: z.boolean(),
        }),
        image: z.object({
          default: gatewayImageModelId<G>().optional(),
        }),
        sheet: z.object({
          analyze: gatewayModelId<G>(),
          format: gatewayModelId<G>(),
        }),
        text: z.object({
          polish: gatewayModelId<G>(),
        }),
        video: z.object({
          default: gatewayVideoModelId<G>().optional(),
        }),
      })
      .describe("Default model and runtime configuration grouped by tool"),
    workflows: z
      .object({
        chat: gatewayModelId<G>(),
        chatImageCompatible: gatewayModelId<G>(),
        pdf: gatewayModelId<G>(),
        title: gatewayModelId<G>(),
      })
      .describe("Default model for shared app workflows"),
  });
/* oxlint-enable id-length, max-lines-per-function, typescript/explicit-function-return-type, unicorn/max-nested-calls */

const installedGatewaySchema = createAiSchema(gatewayType);

const aiConfigSchema = installedGatewaySchema.default({
  gateway: gatewayType,
  ...gatewayModelDefaults,
});

const pricingConfigSchema = z.object({
  currency: z.string().optional(),
  free: z
    .object({
      name: z.string(),
      summary: z.string(),
    })
    .optional(),
  pro: z
    .object({
      monthlyPrice: z.number(),
      name: z.string(),
      summary: z.string(),
    })
    .optional(),
});

const anonymousConfigObjectSchema = z.object({
  availableTools: z
    .array(toolName())
    .describe("Tools available to anonymous users"),
  credits: z.number().describe("Message credits for anonymous users"),
  rateLimit: z
    .object({
      requestsPerMinute: z.number(),
      requestsPerMonth: z.number(),
    })
    .describe("Rate limits"),
});

const ANONYMOUS_DEFAULTS: z.input<typeof anonymousConfigObjectSchema> = {
  availableTools: [],
  credits: 10,
  rateLimit: {
    requestsPerMinute: 5,
    requestsPerMonth: 10,
  },
};

const anonymousConfigSchema =
  anonymousConfigObjectSchema.default(ANONYMOUS_DEFAULTS);

/* oxlint-disable unicorn/max-nested-calls -- moving it below executable initialization can obscure ordering and API ownership.
unicorn/max-nested-calls (#568): attachmentsConfigObjectSchema keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold. */
const attachmentsConfigObjectSchema = z.object({
  acceptedTypes: z
    .object({
      "application/pdf": z.array(z.string()),
      "image/jpeg": z.array(z.string()),
      "image/png": z.array(z.string()),
    })
    .describe("Accepted MIME types with their file extensions"),
  maxBytes: z.number().describe("Max file size in bytes after compression"),
  maxDimension: z.number().describe("Max image dimension"),
});
/* oxlint-enable unicorn/max-nested-calls */

/* oxlint-disable no-magic-numbers -- moving it below executable initialization can obscure ordering and API ownership.
no-magic-numbers (#517): ATTACHMENTS_DEFAULTS uses 1024 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions. */
const ATTACHMENTS_DEFAULTS = {
  acceptedTypes: {
    "application/pdf": [".pdf"],
    "image/jpeg": [".jpg", ".jpeg"],
    "image/png": [".png"],
  },
  maxBytes: 1024 * 1024,
  maxDimension: 2048,
};
/* oxlint-enable no-magic-numbers */

const attachmentsConfigSchema =
  attachmentsConfigObjectSchema.default(ATTACHMENTS_DEFAULTS);

const featuresConfigObjectSchema = z.strictObject({
  parallelResponses: z
    .boolean()
    .default(true)
    .describe("Send one message to multiple models simultaneously"),
});

const FEATURES_DEFAULTS = {
  parallelResponses: true,
};

const featuresConfigSchema =
  featuresConfigObjectSchema.default(FEATURES_DEFAULTS);

const authenticationConfigObjectSchema = z.object({
  github: z
    .boolean()
    .describe("GitHub OAuth (requires AUTH_GITHUB_ID + AUTH_GITHUB_SECRET)"),
  google: z
    .boolean()
    .describe("Google OAuth (requires AUTH_GOOGLE_ID + AUTH_GOOGLE_SECRET)"),
  vercel: z
    .boolean()
    .describe(
      "Vercel OAuth (requires VERCEL_APP_CLIENT_ID + VERCEL_APP_CLIENT_SECRET)"
    ),
});

const AUTHENTICATION_DEFAULTS = {
  github: true,
  google: false,
  vercel: false,
};

const authenticationConfigSchema = authenticationConfigObjectSchema.default(
  AUTHENTICATION_DEFAULTS
);

const desktopAppConfigObjectSchema = z.object({
  enabled: z
    .boolean()
    .describe("Enable Electron desktop auth/runtime integration"),
});

const DESKTOP_APP_DEFAULTS = {
  enabled: false,
};

const desktopAppConfigSchema =
  desktopAppConfigObjectSchema.default(DESKTOP_APP_DEFAULTS);

/* oxlint-disable unicorn/max-nested-calls -- moving it below executable initialization can obscure ordering and API ownership.
unicorn/max-nested-calls (#568): configDescriptionSchema keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold. */
const configDescriptionSchema = z.object({
  ai: installedGatewaySchema,
  anonymous: anonymousConfigObjectSchema,
  appDescription: z.string().default("AI chat powered by ChatJS"),
  appName: z.string().default("My AI Chat"),
  appPrefix: z.string().default("chatjs"),
  appTitle: z
    .string()
    .optional()
    .describe("Browser tab title (defaults to appName)"),
  appUrl: z.url().default("https://your-domain.com"),
  attachments: attachmentsConfigObjectSchema,
  authentication: authenticationConfigObjectSchema,
  desktopApp: desktopAppConfigObjectSchema,
  features: featuresConfigObjectSchema,
  legal: z.object({
    governingLaw: z.string(),
    minimumAge: z.number(),
    refundPolicy: z.string(),
  }),
  organization: z.object({
    contact: z.object({
      legalEmail: z.email(),
      privacyEmail: z.email(),
    }),
    name: z.string(),
  }),
  policies: z.object({
    privacy: z.object({
      lastUpdated: z.string().optional(),
      title: z.string(),
    }),
    terms: z.object({
      lastUpdated: z.string().optional(),
      title: z.string(),
    }),
  }),
  pricing: pricingConfigSchema.optional(),
  services: z.object({
    aiProviders: z.array(z.string()),
    hosting: z.string(),
    paymentProcessors: z.array(z.string()),
  }),
});
/* oxlint-enable unicorn/max-nested-calls */

/* oxlint-disable unicorn/max-nested-calls -- moving it below executable initialization can obscure ordering and API ownership.
unicorn/max-nested-calls (#568): configSchema keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold. */
const configSchema = z.object({
  ai: aiConfigSchema,
  anonymous: anonymousConfigSchema,
  appDescription: z.string().default("AI chat powered by ChatJS"),
  appName: z.string().default("My AI Chat"),
  appPrefix: z.string().default("chatjs"),
  appTitle: z
    .string()
    .optional()
    .describe("Browser tab title (defaults to appName)"),
  appUrl: z.url().default("https://your-domain.com"),
  attachments: attachmentsConfigSchema,
  authentication: authenticationConfigSchema,
  desktopApp: desktopAppConfigSchema,
  features: featuresConfigSchema,
  legal: z
    .object({
      governingLaw: z.string(),
      minimumAge: z.number(),
      refundPolicy: z.string(),
    })
    .default({
      governingLaw: "United States",
      minimumAge: 13,
      refundPolicy: "no-refunds",
    }),
  organization: z
    .object({
      contact: z.object({
        legalEmail: z.email(),
        privacyEmail: z.email(),
      }),
      name: z.string(),
    })
    .default({
      contact: {
        legalEmail: "legal@your-domain.com",
        privacyEmail: "privacy@your-domain.com",
      },
      name: "Your Organization",
    }),
  policies: z
    .object({
      privacy: z.object({
        lastUpdated: z.string().optional(),
        title: z.string(),
      }),
      terms: z.object({
        lastUpdated: z.string().optional(),
        title: z.string(),
      }),
    })
    .default({
      privacy: { title: "Privacy Policy" },
      terms: { title: "Terms of Service" },
    }),
  pricing: pricingConfigSchema.optional(),
  services: z
    .object({
      aiProviders: z.array(z.string()),
      hosting: z.string(),
      paymentProcessors: z.array(z.string()),
    })
    .default({
      aiProviders: ["OpenAI", "Anthropic", "Google"],
      hosting: "Vercel",
      paymentProcessors: [],
    }),
});
/* oxlint-enable unicorn/max-nested-calls */

// Output types (after defaults applied)
type Config = z.infer<typeof configSchema>;

type PricingConfig = z.infer<typeof pricingConfigSchema>;

type AiConfig = z.infer<typeof aiConfigSchema>;

type AnonymousConfig = z.infer<typeof anonymousConfigSchema>;

type AttachmentsConfig = z.infer<typeof attachmentsConfigSchema>;

type FeaturesConfig = z.infer<typeof featuresConfigSchema>;

type AuthenticationConfig = z.infer<typeof authenticationConfigSchema>;

type DesktopAppConfig = z.infer<typeof desktopAppConfigSchema>;

// Gateway-aware input types: model IDs narrowed per gateway for autocomplete
type ZodConfigInput = z.input<typeof configSchema>;

// Model IDs come from the installed gateway.
type AiShape = z.input<typeof installedGatewaySchema>;
type AiToolsShape = AiShape["tools"];

/* oxlint-disable id-length --
 * id-length (#506): DeepResearchToolInputFor uses G as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 */
// All helper types are Partial — fields not provided are filled by applyDefaults
type DeepResearchToolInputFor<G extends GatewayType> = Partial<
  Omit<AiToolsShape["deepResearch"], "defaultModel" | "finalReportModel"> & {
    defaultModel: GatewayModelIdMap[G];
    finalReportModel: GatewayModelIdMap[G];
  }
>;
/* oxlint-enable id-length */
/* oxlint-disable id-length, typescript/consistent-type-definitions --
 * id-length (#506): ImageToolInputFor uses G as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 * typescript/consistent-type-definitions (#559): ImageToolInputFor preserves its current alias/interface semantics; declaration merging and implicit index-signature assignability differ between those forms.
 */
type ImageToolInputFor<G extends GatewayType> = {
  default?: GatewayImageModelIdMap[G];
};
/* oxlint-enable id-length, typescript/consistent-type-definitions */
/* oxlint-disable id-length, typescript/consistent-type-definitions --
 * id-length (#506): VideoToolInputFor uses G as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 * typescript/consistent-type-definitions (#559): VideoToolInputFor preserves its current alias/interface semantics; declaration merging and implicit index-signature assignability differ between those forms.
 */
type VideoToolInputFor<G extends GatewayType> = {
  default?: GatewayVideoModelIdMap[G];
};
/* oxlint-enable id-length, typescript/consistent-type-definitions */
/* oxlint-disable id-length --
 * id-length (#506): FollowupSuggestionsToolInputFor uses G as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 */
type FollowupSuggestionsToolInputFor<G extends GatewayType> = Partial<{
  enabled: boolean;
  default: GatewayModelIdMap[G];
}>;
/* oxlint-enable id-length */
/* oxlint-disable id-length --
 * id-length (#506): AiToolsInputFor uses G; P as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 */
interface AiToolsInputFor<G extends GatewayType> {
  code?: Partial<{ [P in keyof AiToolsShape["code"]]: GatewayModelIdMap[G] }>;
  deepResearch?: DeepResearchToolInputFor<G>;
  followupSuggestions?: FollowupSuggestionsToolInputFor<G>;
  image?: ImageToolInputFor<G>;
  sheet?: Partial<{ [P in keyof AiToolsShape["sheet"]]: GatewayModelIdMap[G] }>;
  text?: Partial<{ [P in keyof AiToolsShape["text"]]: GatewayModelIdMap[G] }>;
  video?: VideoToolInputFor<G>;
}
/* oxlint-enable id-length */

/* oxlint-disable id-length, typescript/consistent-type-definitions --
 * id-length (#506): AiInputFor uses G; W as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 * typescript/consistent-type-definitions (#559): AiInputFor preserves its current alias/interface semantics; declaration merging and implicit index-signature assignability differ between those forms.
 */
// Only gateway is required; everything else is an override on top of GATEWAY_MODEL_DEFAULTS
type AiInputFor<G extends GatewayType> = {
  gateway: G;
  providerOrder?: AiShape["providerOrder"];
  disabledModels?: GatewayModelIdMap[G][];
  curatedDefaults?: GatewayModelIdMap[G][];
  anonymousModels?: GatewayModelIdMap[G][];
  workflows?: Partial<{
    [W in keyof AiShape["workflows"]]: GatewayModelIdMap[G];
  }>;
  tools?: AiToolsInputFor<G>;
};
/* oxlint-enable id-length, typescript/consistent-type-definitions */

/* oxlint-disable id-length --
 * id-length (#506): ConfigInputForGateway uses G as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 */
type ConfigInputForGateway<G extends GatewayType> = Omit<
  ZodConfigInput,
  "ai"
> & {
  ai?: AiInputFor<G>;
};
/* oxlint-enable id-length */

// Each installation selects one gateway and its corresponding model IDs.
type ConfigInput = ConfigInputForGateway<GatewayType>;

/* oxlint-disable id-length, jsdoc/require-param, jsdoc/require-returns -- id-length (#506): defineConfig uses T as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
moving it below executable initialization can obscure ordering and API ownership.
jsdoc/require-param (#534): defineConfig's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
jsdoc/require-returns (#535): defineConfig's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags. */
/**
 * Type-safe config helper. Infers the gateway type from `ai.gateway` so
 * autocomplete and error messages are scoped to the chosen gateway's model IDs.
 * Only `ai.gateway` is required — all other `ai` fields are optional overrides
 * on top of the gateway defaults supplied by `applyDefaults`.
 */
const defineConfig = <const T extends ConfigInput>(config: T): T => config;
/* oxlint-enable id-length, jsdoc/require-param, jsdoc/require-returns */

/* oxlint-disable id-length, typescript/prefer-readonly-parameter-types --
 * id-length (#506): mergeToolsConfig uses T as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 * typescript/prefer-readonly-parameter-types (#565): mergeToolsConfig accepts user: Record<string, unknown> | undefined; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
const mergeToolsConfig = <T extends Record<string, unknown>>(
  defaults: T,
  user: Record<string, unknown> | undefined
): T => {
  if (!user) {
    return defaults;
  }
  const result: Record<string, unknown> = { ...defaults };
  for (const [key, val] of Object.entries(user)) {
    const defVal = result[key];
    result[key] =
      val !== null &&
      typeof val === "object" &&
      !Array.isArray(val) &&
      defVal !== null &&
      typeof defVal === "object" &&
      !Array.isArray(defVal)
        ? { ...defVal, ...val }
        : val;
  }
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- #599: Configuration merging preserves generic defaults and legacy input shapes; validating the intermediate representation requires a separate config migration.
  return result as T;
};
/* oxlint-enable id-length, typescript/prefer-readonly-parameter-types */

/* oxlint-disable typescript/prefer-readonly-parameter-types -- typescript/prefer-readonly-parameter-types (#565): applyDefaults accepts input: ConfigInput; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration. */
// Apply defaults to partial config
const applyDefaults = (input: ConfigInput): Config => {
  const gateway = input.ai?.gateway ?? gatewayType;
  const gatewayDefaults = gatewayModelDefaults;
  const aiInput = input.ai as Record<string, unknown> | undefined;

  const mergedAi = {
    gateway,
    ...gatewayDefaults,
    ...aiInput,
    tools: mergeToolsConfig(
      gatewayDefaults.tools,
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- #599: Configuration merging preserves generic defaults and legacy input shapes; validating the intermediate representation requires a separate config migration.
      aiInput?.tools as Record<string, unknown> | undefined
    ),
    workflows: {
      ...gatewayDefaults.workflows,
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- #599: Configuration merging preserves generic defaults and legacy input shapes; validating the intermediate representation requires a separate config migration.
      ...(aiInput?.workflows as Record<string, unknown> | undefined),
    },
  };

  return configSchema.parse({ ...input, ai: mergedAi });
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-disable max-lines -- #509: This config-schema.ts module keeps its existing API and workflow boundaries; splitting it requires an ownership design. EOF-scoped exception applies only to this file-level line metric. */
export {
  aiConfigSchema,
  ANONYMOUS_DEFAULTS,
  anonymousConfigObjectSchema,
  anonymousConfigSchema,
  applyDefaults,
  ATTACHMENTS_DEFAULTS,
  attachmentsConfigObjectSchema,
  attachmentsConfigSchema,
  AUTHENTICATION_DEFAULTS,
  authenticationConfigObjectSchema,
  authenticationConfigSchema,
  configDescriptionSchema,
  configSchema,
  defineConfig,
  DESKTOP_APP_DEFAULTS,
  desktopAppConfigObjectSchema,
  desktopAppConfigSchema,
  FEATURES_DEFAULTS,
  featuresConfigObjectSchema,
  featuresConfigSchema,
  pricingConfigSchema,
};
export type {
  AiConfig,
  AnonymousConfig,
  AttachmentsConfig,
  AuthenticationConfig,
  Config,
  ConfigInput,
  DesktopAppConfig,
  FeaturesConfig,
  PricingConfig,
};
export type { GatewayType } from "@/lib/ai/gateways/registry";
