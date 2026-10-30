import { installedToolConfig } from "@/chatjs/generated/installed-config";
import { languageModelSchema, modelRoles } from "./config-models";
import type {
  GatewayModelIdMap,
  GatewayType,
} from "@/lib/ai/gateways/registry";

import { gatewayModelDefaults, gatewayType } from "./ai/gateway-model-defaults";
import { isNonEmptyString } from "./is-non-empty-string";

import { z } from "zod";

// Helper to create typed model ID schemas

// =====================================================
// AI config — discriminated union keyed on gateway
// =====================================================

const gatewayModelId = <Gateway extends GatewayType>(): z.ZodCustom<
  GatewayModelIdMap[Gateway],
  GatewayModelIdMap[Gateway]
> => z.custom<GatewayModelIdMap[Gateway]>(isNonEmptyString);

const aiToolsSchema = z
  .strictObject({
    followupSuggestions: z
      .strictObject({
        default: languageModelSchema.default(modelRoles.fast),
        enabled: z.boolean().default(false),
      })
      .prefault({}),
    ...installedToolConfig,
  })
  .prefault({});

type AiSchema<Gateway extends GatewayType> = z.ZodObject<{
  curatedDefaults: z.ZodArray<
    z.ZodCustom<GatewayModelIdMap[Gateway], GatewayModelIdMap[Gateway]>
  >;
  disabledModels: z.ZodArray<
    z.ZodCustom<GatewayModelIdMap[Gateway], GatewayModelIdMap[Gateway]>
  >;
  gateway: z.ZodLiteral<Gateway>;
  providerOrder: z.ZodArray<z.ZodString>;
  tools: typeof aiToolsSchema;
  workflows: z.ZodObject<{
    chat: z.ZodCustom<GatewayModelIdMap[Gateway], GatewayModelIdMap[Gateway]>;
    chatImageCompatible: z.ZodCustom<
      GatewayModelIdMap[Gateway],
      GatewayModelIdMap[Gateway]
    >;
    pdf: z.ZodCustom<GatewayModelIdMap[Gateway], GatewayModelIdMap[Gateway]>;
    title: z.ZodCustom<GatewayModelIdMap[Gateway], GatewayModelIdMap[Gateway]>;
  }>;
}>;

const createAiSchema = <Gateway extends GatewayType>(
  gateway: Gateway
): AiSchema<Gateway> =>
  z.object({
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
    tools: aiToolsSchema,
    workflows: z
      .object({
        chat: gatewayModelId<Gateway>(),
        chatImageCompatible: gatewayModelId<Gateway>(),
        pdf: gatewayModelId<Gateway>(),
        title: gatewayModelId<Gateway>(),
      })
      .describe("Default model for shared app workflows"),
  });

const installedGatewaySchema = createAiSchema(gatewayType);

const aiConfigSchema = installedGatewaySchema.prefault({
  gateway: gatewayType,
  ...gatewayModelDefaults,
});

const createOrganizationSchema = (): z.ZodObject<{
  contact: z.ZodObject<{ legalEmail: z.ZodEmail; privacyEmail: z.ZodEmail }>;
  name: z.ZodString;
}> =>
  z.object({
    contact: z.object({ legalEmail: z.email(), privacyEmail: z.email() }),
    name: z.string(),
  });

const createPoliciesSchema = (): z.ZodObject<{
  privacy: z.ZodObject<{
    lastUpdated: z.ZodOptional<z.ZodString>;
    title: z.ZodString;
  }>;
  terms: z.ZodObject<{
    lastUpdated: z.ZodOptional<z.ZodString>;
    title: z.ZodString;
  }>;
}> =>
  z.object({
    privacy: z.object({
      lastUpdated: z.string().optional(),
      title: z.string(),
    }),
    terms: z.object({ lastUpdated: z.string().optional(), title: z.string() }),
  });

const createServicesSchema = (): z.ZodObject<{
  aiProviders: z.ZodArray<z.ZodString>;
  hosting: z.ZodString;
  paymentProcessors: z.ZodArray<z.ZodString>;
}> =>
  z.object({
    aiProviders: z.array(z.string()),
    hosting: z.string(),
    paymentProcessors: z.array(z.string()),
  });

const createAcceptedAttachmentTypesSchema = (): z.ZodObject<{
  "application/pdf": z.ZodArray<z.ZodString>;
  "image/jpeg": z.ZodArray<z.ZodString>;
  "image/png": z.ZodArray<z.ZodString>;
}> =>
  z.object({
    "application/pdf": z.array(z.string()),
    "image/jpeg": z.array(z.string()),
    "image/png": z.array(z.string()),
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

const attachmentsConfigObjectSchema = z.object({
  acceptedTypes: createAcceptedAttachmentTypesSchema().describe(
    "Accepted MIME types with their file extensions"
  ),
  maxBytes: z.number().describe("Max file size in bytes after compression"),
  maxDimension: z.number().describe("Max image dimension"),
});

const BYTES_PER_KIBIBYTE = 1024;
const ATTACHMENTS_DEFAULTS = {
  acceptedTypes: {
    "application/pdf": [".pdf"],
    "image/jpeg": [".jpg", ".jpeg"],
    "image/png": [".png"],
  },
  maxBytes: BYTES_PER_KIBIBYTE * BYTES_PER_KIBIBYTE,
  maxDimension: 2048,
};

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

const configDescriptionSchema = z.object({
  ai: installedGatewaySchema,
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
  features: featuresConfigObjectSchema,
  legal: z.object({
    governingLaw: z.string(),
    minimumAge: z.number(),
    refundPolicy: z.string(),
  }),
  organization: createOrganizationSchema(),
  policies: createPoliciesSchema(),
  pricing: pricingConfigSchema.optional(),
  services: createServicesSchema(),
});

const configSchema = z.object({
  ai: aiConfigSchema,
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
  organization: createOrganizationSchema().default({
    contact: {
      legalEmail: "legal@your-domain.com",
      privacyEmail: "privacy@your-domain.com",
    },
    name: "Your Organization",
  }),
  policies: createPoliciesSchema().default({
    privacy: { title: "Privacy Policy" },
    terms: { title: "Terms of Service" },
  }),
  pricing: pricingConfigSchema.optional(),
  services: createServicesSchema().default({
    aiProviders: ["OpenAI", "Anthropic", "Google"],
    hosting: "Vercel",
    paymentProcessors: [],
  }),
});

// Output types (after defaults applied)
type Config = z.infer<typeof configSchema>;

type PricingConfig = z.infer<typeof pricingConfigSchema>;

type AiConfig = z.infer<typeof aiConfigSchema>;

type AttachmentsConfig = z.infer<typeof attachmentsConfigSchema>;

type FeaturesConfig = z.infer<typeof featuresConfigSchema>;

type AuthenticationConfig = z.infer<typeof authenticationConfigSchema>;

// Gateway-aware input types: model IDs narrowed per gateway for autocomplete
type ZodConfigInput = z.input<typeof configSchema>;

// Model IDs come from the installed gateway.
type AiShape = z.input<typeof installedGatewaySchema>;
type AiToolsInput = z.input<typeof aiToolsSchema>;

// Only gateway is required; everything else is an override on top of GATEWAY_MODEL_DEFAULTS
interface AiInputFor<Gateway extends GatewayType> {
  gateway: Gateway;
  providerOrder?: AiShape["providerOrder"];
  disabledModels?: GatewayModelIdMap[Gateway][];
  curatedDefaults?: GatewayModelIdMap[Gateway][];
  workflows?: Partial<{
    [Workflow in keyof AiShape["workflows"]]: GatewayModelIdMap[Gateway];
  }>;
  tools?: AiToolsInput;
}

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
type InstalledToolOverrides<Input> = Input extends {
  readonly ai: { readonly tools: infer Tools };
}
  ? {
      readonly ai: {
        readonly tools: Record<
          Exclude<keyof Tools, keyof NonNullable<AiToolsInput>>,
          never
        >;
      };
    }
  : unknown;

const defineConfig = <const InputConfig extends ConfigInput>(
  config: InputConfig & InstalledToolOverrides<InputConfig>
): InputConfig => config;

// Apply defaults to partial config
const applyDefaults = (input: ReadonlyConfigData<ConfigInput>): Config => {
  const gateway = (input.ai ?? {}).gateway ?? gatewayType;
  const gatewayDefaults = gatewayModelDefaults;
  const aiInput: ReadonlyConfigData<Partial<AiInputFor<GatewayType>>> =
    input.ai ?? {};

  const mergedAi = {
    gateway,
    ...gatewayDefaults,
    ...aiInput,
    tools: aiInput.tools,
    workflows: {
      ...gatewayDefaults.workflows,
      ...aiInput.workflows,
    },
  };

  return configSchema.parse({ ...input, ai: mergedAi });
};

export {
  aiConfigSchema,
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
  FEATURES_DEFAULTS,
  featuresConfigObjectSchema,
  featuresConfigSchema,
  pricingConfigSchema,
};
export type {
  AiConfig,
  AttachmentsConfig,
  AuthenticationConfig,
  Config,
  ConfigInput,
  FeaturesConfig,
  PricingConfig,
};
export type { GatewayType } from "@/lib/ai/gateways/registry";
