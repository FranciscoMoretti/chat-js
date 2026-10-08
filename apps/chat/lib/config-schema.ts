import { z } from "zod";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type {
  GatewayImageModelIdMap,
  GatewayModelIdMap,
  GatewayType,
  GatewayVideoModelIdMap,
} from "@/lib/ai/gateways/registry";
/* oxlint-enable sort-imports */

import { gatewayModelDefaults, gatewayType } from "./ai/gateway-model-defaults";
import type { ToolName } from "./ai/types";

// Helper to create typed model ID schemas
const toolName = (): z.ZodCustom<ToolName, ToolName> => z.custom<ToolName>();

// =====================================================
// AI config — discriminated union keyed on gateway
// =====================================================

const gatewayModelId = <Gateway extends GatewayType>(): z.ZodCustom<
  GatewayModelIdMap[Gateway],
  GatewayModelIdMap[Gateway]
> => z.custom<GatewayModelIdMap[Gateway]>((value) => typeof value === "string");

const gatewayImageModelId = <Gateway extends GatewayType>(): z.ZodCustom<
  GatewayImageModelIdMap[Gateway],
  GatewayImageModelIdMap[Gateway]
> =>
  z.custom<GatewayImageModelIdMap[Gateway]>(
    (value) => typeof value === "string"
  );

const gatewayVideoModelId = <Gateway extends GatewayType>(): z.ZodCustom<
  GatewayVideoModelIdMap[Gateway],
  GatewayVideoModelIdMap[Gateway]
> =>
  z.custom<GatewayVideoModelIdMap[Gateway]>(
    (value) => typeof value === "string"
  );

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

/* oxlint-disable max-lines-per-function, typescript/explicit-function-return-type, unicorn/max-nested-calls --
 * max-lines-per-function (#510): createAiSchema keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * typescript/explicit-function-return-type (#560): Keep createAiSchema's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * unicorn/max-nested-calls (#568): createAiSchema keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 */
const createAiSchema = <Gateway extends GatewayType>(gateway: Gateway) =>
  z.object({
    anonymousModels: z
      .array(gatewayModelId<Gateway>())
      .describe("Models available to anonymous users"),
    curatedDefaults: z
      .array(gatewayModelId<Gateway>())
      .describe("Default models enabled for new users"),
    disabledModels: z
      .array(gatewayModelId<Gateway>())
      .describe("Models to hide from all users"),
    gateway: z.literal(gateway),
    providerOrder: z
      .array(z.string())
      .describe("Provider sort order in model selector"),
    tools: z
      .object({
        code: z.object({
          edits: gatewayModelId<Gateway>(),
        }),
        deepResearch: deepResearchToolConfigSchema.extend({
          defaultModel: gatewayModelId<Gateway>(),
          finalReportModel: gatewayModelId<Gateway>(),
        }),
        followupSuggestions: z.object({
          default: gatewayModelId<Gateway>(),
          enabled: z.boolean(),
        }),
        image: z.object({
          default: gatewayImageModelId<Gateway>().optional(),
        }),
        sheet: z.object({
          analyze: gatewayModelId<Gateway>(),
          format: gatewayModelId<Gateway>(),
        }),
        text: z.object({
          polish: gatewayModelId<Gateway>(),
        }),
        video: z.object({
          default: gatewayVideoModelId<Gateway>().optional(),
        }),
      })
      .describe("Default model and runtime configuration grouped by tool"),
    workflows: z
      .object({
        chat: gatewayModelId<Gateway>(),
        chatImageCompatible: gatewayModelId<Gateway>(),
        pdf: gatewayModelId<Gateway>(),
        title: gatewayModelId<Gateway>(),
      })
      .describe("Default model for shared app workflows"),
  });
/* oxlint-enable max-lines-per-function, typescript/explicit-function-return-type, unicorn/max-nested-calls */

const installedGatewaySchema = createAiSchema(gatewayType);

const aiConfigSchema = installedGatewaySchema.default({
  gateway: gatewayType,
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing gatewayModelDefaults own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
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

// All helper types are Partial — fields not provided are filled by applyDefaults
type DeepResearchToolInputFor<Gateway extends GatewayType> = Partial<
  Omit<AiToolsShape["deepResearch"], "defaultModel" | "finalReportModel"> & {
    defaultModel: GatewayModelIdMap[Gateway];
    finalReportModel: GatewayModelIdMap[Gateway];
  }
>;
/* oxlint-disable typescript/consistent-type-definitions --
 * typescript/consistent-type-definitions (#559): ImageToolInputFor is part of exported ConfigInput; retaining an object alias preserves implicit index-signature assignability for consumers accepting records.
 */
type ImageToolInputFor<Gateway extends GatewayType> = {
  default?: GatewayImageModelIdMap[Gateway];
};
/* oxlint-enable typescript/consistent-type-definitions */
/* oxlint-disable typescript/consistent-type-definitions --
 * typescript/consistent-type-definitions (#559): VideoToolInputFor is part of exported ConfigInput; retaining an object alias preserves implicit index-signature assignability for consumers accepting records.
 */
type VideoToolInputFor<Gateway extends GatewayType> = {
  default?: GatewayVideoModelIdMap[Gateway];
};
/* oxlint-enable typescript/consistent-type-definitions */
type FollowupSuggestionsToolInputFor<Gateway extends GatewayType> = Partial<{
  enabled: boolean;
  default: GatewayModelIdMap[Gateway];
}>;
interface AiToolsInputFor<Gateway extends GatewayType> {
  code?: Partial<{
    [ToolOption in keyof AiToolsShape["code"]]: GatewayModelIdMap[Gateway];
  }>;
  deepResearch?: DeepResearchToolInputFor<Gateway>;
  followupSuggestions?: FollowupSuggestionsToolInputFor<Gateway>;
  image?: ImageToolInputFor<Gateway>;
  sheet?: Partial<{
    [ToolOption in keyof AiToolsShape["sheet"]]: GatewayModelIdMap[Gateway];
  }>;
  text?: Partial<{
    [ToolOption in keyof AiToolsShape["text"]]: GatewayModelIdMap[Gateway];
  }>;
  video?: VideoToolInputFor<Gateway>;
}

/* oxlint-disable typescript/consistent-type-definitions --
 * typescript/consistent-type-definitions (#559): AiInputFor is part of exported ConfigInput; retaining an object alias preserves implicit index-signature assignability for consumers accepting records.
 */
// Only gateway is required; everything else is an override on top of GATEWAY_MODEL_DEFAULTS
type AiInputFor<Gateway extends GatewayType> = {
  gateway: Gateway;
  providerOrder?: AiShape["providerOrder"];
  disabledModels?: GatewayModelIdMap[Gateway][];
  curatedDefaults?: GatewayModelIdMap[Gateway][];
  anonymousModels?: GatewayModelIdMap[Gateway][];
  workflows?: Partial<{
    [Workflow in keyof AiShape["workflows"]]: GatewayModelIdMap[Gateway];
  }>;
  tools?: AiToolsInputFor<Gateway>;
};
/* oxlint-enable typescript/consistent-type-definitions */

type ConfigInputForGateway<Gateway extends GatewayType> = Omit<
  ZodConfigInput,
  "ai"
> & {
  ai?: AiInputFor<Gateway>;
};

// Each installation selects one gateway and its corresponding model IDs.
type ConfigInput = ConfigInputForGateway<GatewayType>;

// Configuration readers consume data, including readonly nested arrays. Open
// SDK string intersections accept every string; keep curated literal unions
// narrow while reading those open fields as strings. defineConfig retains the
// original provider types and autocomplete contract.
type ReadonlyConfigData<Value> = Value extends string
  ? string extends Value
    ? string
    : Value
  : Value extends readonly (infer Item)[]
    ? readonly ReadonlyConfigData<Item>[]
    : Value extends object
      ? { readonly [Key in keyof Value]: ReadonlyConfigData<Value[Key]> }
      : Value;

/**
 * Preserve literal gateway/model selections for configuration autocomplete.
 * Defaults and runtime validation are applied later by applyDefaults.
 * @param {InputConfig} config Partial configuration with gateway-specific model selections.
 * @returns {InputConfig} The exact input object, retaining its inferred literal field types.
 */
const defineConfig = <const InputConfig extends ConfigInput>(
  config: InputConfig
): InputConfig => config;

const mergeToolsConfig = (
  defaults: Readonly<Record<string, unknown>>,
  user: ReadonlyConfigData<AiToolsInputFor<GatewayType>> | undefined
): Record<string, unknown> => {
  if (!user) {
    return defaults;
  }
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the fresh shallow copy of defaults rather than sharing its source identity; pinned eslint/prefer-object-spread rejects Object.assign.
  const result: Record<string, unknown> = { ...defaults };
  const entries: [string, unknown][] = Object.entries(user);
  for (const [key, value] of entries) {
    const defaultValue = result[key];
    result[key] =
      // oxlint-disable-next-line no-ternary -- Keep = operand as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      defaultValue !== null &&
      typeof defaultValue === "object" &&
      !Array.isArray(defaultValue)
        ? // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing defaultValue own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement. Keep the existing value own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
          { ...defaultValue, ...value }
        : value;
  }
  return result;
};

// Apply defaults to partial config
const applyDefaults = (input: ReadonlyConfigData<ConfigInput>): Config => {
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading gateway from input.ai; preserve one receiver evaluation, skipped accesses and the existing gatewayType fallback. The app guidance prefers optional chaining.
  const gateway = input.ai?.gateway ?? gatewayType;
  const gatewayDefaults = gatewayModelDefaults;
  const aiInput = input.ai;

  const mergedAi = {
    gateway,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing gatewayDefaults own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    ...gatewayDefaults,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing aiInput own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    ...aiInput,
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading tools from aiInput; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
    tools: mergeToolsConfig(gatewayDefaults.tools, aiInput?.tools),
    workflows: {
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing gatewayDefaults.workflows own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
      ...gatewayDefaults.workflows,
      // oxlint-disable-next-line oxc/no-rest-spread-properties, oxc/no-optional-chaining -- Keep the existing aiInput?.workflows own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement. Optional chain: Keep the existing nullish guard when reading workflows from aiInput; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
      ...aiInput?.workflows,
    },
  };

  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing input own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
  return configSchema.parse({ ...input, ai: mergedAi });
};

/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (aiConfigSchema, ANONYMOUS_DEFAULTS, anonymousConfigObjectSchema, anonymousConfigSchema, applyDefaults, ATTACHMENTS_DEFAULTS, attachmentsConfigObjectSchema, attachmentsConfigSchema, AUTHENTICATION_DEFAULTS, authenticationConfigObjectSchema, authenticationConfigSchema, configDescriptionSchema, configSchema, defineConfig, DESKTOP_APP_DEFAULTS, desktopAppConfigObjectSchema, desktopAppConfigSchema, FEATURES_DEFAULTS, featuresConfigObjectSchema, featuresConfigSchema, pricingConfigSchema); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
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
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Keep the named type bindings (AiConfig, AnonymousConfig, AttachmentsConfig, AuthenticationConfig, Config, ConfigInput, DesktopAppConfig, FeaturesConfig, PricingConfig); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
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
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Keep the named type bindings (GatewayType); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export type { GatewayType } from "@/lib/ai/gateways/registry";
/* oxlint-enable import/no-named-export */
