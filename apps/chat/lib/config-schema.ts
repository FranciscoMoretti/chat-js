import { z } from "zod";

import type {
  GatewayImageModelIdMap,
  GatewayModelIdMap,
  GatewayType,
  GatewayVideoModelIdMap,
} from "@/lib/ai/gateways/registry";

import { gatewayModelDefaults, gatewayType } from "./ai/gateway-model-defaults";
import type { ToolName } from "./ai/types";

export type { GatewayType } from "@/lib/ai/gateways/registry";

// Helper to create typed model ID schemas
const toolName = () => z.custom<ToolName>();

// =====================================================
// AI config — discriminated union keyed on gateway
// =====================================================

const gatewayModelId = <G extends GatewayType>() =>
  z.custom<GatewayModelIdMap[G]>((v) => typeof v === "string");

const gatewayImageModelId = <G extends GatewayType>() =>
  z.custom<GatewayImageModelIdMap[G]>((v) => typeof v === "string");

const gatewayVideoModelId = <G extends GatewayType>() =>
  z.custom<GatewayVideoModelIdMap[G]>((v) => typeof v === "string");

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

const createAiSchema = <G extends GatewayType>(g: G) =>
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
    gateway: z.literal(g),
    providerOrder: z
      .array(z.string())
      .describe("Provider sort order in model selector"),
    tools: z
      .object({
        code: z.object({
          edits: gatewayModelId<G>(),
        }),
        codeExecution: z.object({
          enabled: z
            .boolean()
            .describe("Requires Vercel sandbox credentials outside Vercel"),
        }),
        deepResearch: deepResearchToolConfigSchema.extend({
          defaultModel: gatewayModelId<G>(),
          enabled: z.boolean().describe("Requires web search access"),
          finalReportModel: gatewayModelId<G>(),
        }),
        documents: z.object({
          enabled: z.boolean().describe("Document create/edit/review support"),
          types: z.object({
            code: z.boolean(),
            sheet: z.boolean(),
            text: z.boolean(),
          }),
        }),
        followupSuggestions: z.object({
          default: gatewayModelId<G>(),
          enabled: z.boolean(),
        }),
        image: z.object({
          default: gatewayImageModelId<G>().optional(),
          enabled: z.boolean().describe("Enable the installed image tool"),
        }),
        mcp: z.object({
          enabled: z.boolean().describe("Requires MCP_ENCRYPTION_KEY"),
        }),
        sheet: z.object({
          analyze: gatewayModelId<G>(),
          format: gatewayModelId<G>(),
        }),
        text: z.object({
          polish: gatewayModelId<G>(),
        }),
        urlRetrieval: z.object({
          enabled: z
            .boolean()
            .describe("Requires the selected URL retrieval tool’s credentials"),
        }),
        video: z.object({
          default: gatewayVideoModelId<G>().optional(),
          enabled: z.boolean().describe("Enable the installed video tool"),
        }),
        webSearch: z.object({
          enabled: z
            .boolean()
            .describe("Requires TAVILY_API_KEY or FIRECRAWL_API_KEY"),
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

const installedGatewaySchema = createAiSchema(gatewayType);

export const aiConfigSchema = installedGatewaySchema.default({
  gateway: gatewayType,
  ...gatewayModelDefaults,
});

export const pricingConfigSchema = z.object({
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

export const anonymousConfigObjectSchema = z.object({
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

export const ANONYMOUS_DEFAULTS: z.input<typeof anonymousConfigObjectSchema> = {
  availableTools: [],
  credits: 10,
  rateLimit: {
    requestsPerMinute: 5,
    requestsPerMonth: 10,
  },
};

export const anonymousConfigSchema =
  anonymousConfigObjectSchema.default(ANONYMOUS_DEFAULTS);

export const attachmentsConfigObjectSchema = z.object({
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

export const ATTACHMENTS_DEFAULTS = {
  acceptedTypes: {
    "application/pdf": [".pdf"],
    "image/jpeg": [".jpg", ".jpeg"],
    "image/png": [".png"],
  },
  maxBytes: 1024 * 1024,
  maxDimension: 2048,
};

export const attachmentsConfigSchema =
  attachmentsConfigObjectSchema.default(ATTACHMENTS_DEFAULTS);

export const featuresConfigObjectSchema = z.object({
  attachments: z
    .boolean()
    .describe("File attachments (requires configured file storage)"),
  parallelResponses: z
    .boolean()
    .default(true)
    .describe("Send one message to multiple models simultaneously"),
});

export const FEATURES_DEFAULTS = {
  attachments: false,
  parallelResponses: true,
};

export const featuresConfigSchema =
  featuresConfigObjectSchema.default(FEATURES_DEFAULTS);

export const authenticationConfigObjectSchema = z.object({
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

export const AUTHENTICATION_DEFAULTS = {
  github: true,
  google: false,
  vercel: false,
};

export const authenticationConfigSchema =
  authenticationConfigObjectSchema.default(AUTHENTICATION_DEFAULTS);
export const desktopAppConfigObjectSchema = z.object({
  enabled: z
    .boolean()
    .describe("Enable Electron desktop auth/runtime integration"),
});

export const DESKTOP_APP_DEFAULTS = {
  enabled: false,
};

export const desktopAppConfigSchema =
  desktopAppConfigObjectSchema.default(DESKTOP_APP_DEFAULTS);

export const configDescriptionSchema = z.object({
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
      legalEmail: z.string().email(),
      privacyEmail: z.string().email(),
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

export const configSchema = z.object({
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
        legalEmail: z.string().email(),
        privacyEmail: z.string().email(),
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

// Output types (after defaults applied)
export type Config = z.infer<typeof configSchema>;
export type PricingConfig = z.infer<typeof pricingConfigSchema>;
export type AiConfig = z.infer<typeof aiConfigSchema>;
export type AnonymousConfig = z.infer<typeof anonymousConfigSchema>;
export type AttachmentsConfig = z.infer<typeof attachmentsConfigSchema>;
export type FeaturesConfig = z.infer<typeof featuresConfigSchema>;
export type AuthenticationConfig = z.infer<typeof authenticationConfigSchema>;
export type DesktopAppConfig = z.infer<typeof desktopAppConfigSchema>;

// Gateway-aware input types: model IDs narrowed per gateway for autocomplete
type ZodConfigInput = z.input<typeof configSchema>;

// Model IDs come from the installed gateway.
type AiShape = z.input<typeof installedGatewaySchema>;
type AiToolsShape = AiShape["tools"];

// All helper types are Partial — fields not provided are filled by applyDefaults
type DeepResearchToolInputFor<G extends GatewayType> = Partial<
  Omit<AiToolsShape["deepResearch"], "defaultModel" | "finalReportModel"> & {
    defaultModel: GatewayModelIdMap[G];
    finalReportModel: GatewayModelIdMap[G];
  }
>;
type ImageToolInputFor<G extends GatewayType> = {
  enabled?: boolean;
  default?: GatewayImageModelIdMap[G];
};
type VideoToolInputFor<G extends GatewayType> = {
  enabled?: boolean;
  default?: GatewayVideoModelIdMap[G];
};
type FollowupSuggestionsToolInputFor<G extends GatewayType> = Partial<{
  enabled: boolean;
  default: GatewayModelIdMap[G];
}>;
interface AiToolsInputFor<G extends GatewayType> {
  code?: Partial<{ [P in keyof AiToolsShape["code"]]: GatewayModelIdMap[G] }>;
  codeExecution?: Partial<AiToolsShape["codeExecution"]>;
  deepResearch?: DeepResearchToolInputFor<G>;
  documents?: Partial<Omit<AiToolsShape["documents"], "types">> & {
    types?: AiToolsShape["documents"]["types"];
  };
  followupSuggestions?: FollowupSuggestionsToolInputFor<G>;
  image?: ImageToolInputFor<G>;
  mcp?: Partial<AiToolsShape["mcp"]>;
  sheet?: Partial<{ [P in keyof AiToolsShape["sheet"]]: GatewayModelIdMap[G] }>;
  text?: Partial<{ [P in keyof AiToolsShape["text"]]: GatewayModelIdMap[G] }>;
  urlRetrieval?: Partial<AiToolsShape["urlRetrieval"]>;
  video?: VideoToolInputFor<G>;
  webSearch?: Partial<AiToolsShape["webSearch"]>;
}

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

type ConfigInputForGateway<G extends GatewayType> = Omit<
  ZodConfigInput,
  "ai"
> & {
  ai?: AiInputFor<G>;
};

export type ConfigInput = {
  [G in GatewayType]: ConfigInputForGateway<G>;
}[GatewayType];

/**
 * Type-safe config helper. Infers the gateway type from `ai.gateway` so
 * autocomplete and error messages are scoped to the chosen gateway's model IDs.
 * Only `ai.gateway` is required — all other `ai` fields are optional overrides
 * on top of the gateway defaults supplied by `applyDefaults`.
 */
export const defineConfig = <const T extends ConfigInput>(config: T): T =>
  config;

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
        ? { ...defVal, ...(val as object) }
        : val;
  }
  return result as T;
};

// Apply defaults to partial config
export const applyDefaults = (input: ConfigInput): Config => {
  const gateway = input.ai?.gateway ?? gatewayType;
  const gatewayDefaults = gatewayModelDefaults;
  const aiInput = input.ai as Record<string, unknown> | undefined;

  const mergedAi = {
    gateway,
    ...gatewayDefaults,
    ...aiInput,
    tools: mergeToolsConfig(
      gatewayDefaults.tools,
      aiInput?.tools as Record<string, unknown> | undefined
    ),
    workflows: {
      ...gatewayDefaults.workflows,
      ...(aiInput?.workflows as Record<string, unknown> | undefined),
    },
  };

  return configSchema.parse({ ...input, ai: mergedAi });
};
