import { defineConfig } from "@/lib/config-schema";

/* oxlint-disable node/no-process-env --
 * node/no-process-env (#537): isProd reads process.env at the environment/configuration boundary; moving this access requires preserving runtime and test override behavior.
 */
const isProd = process.env.NODE_ENV === "production";
/* oxlint-enable node/no-process-env */
const PRODUCTION_ANONYMOUS_CREDITS = 10;
const DEVELOPMENT_ANONYMOUS_CREDITS = 1000;
const PRODUCTION_REQUESTS_PER_MINUTE = 5;
const DEVELOPMENT_REQUESTS_PER_MINUTE = 60;
const PRODUCTION_REQUESTS_PER_MONTH = 10;
const DEVELOPMENT_REQUESTS_PER_MONTH = 1000;
const MAX_ATTACHMENT_BYTES = 1_048_576;
/**
 * ChatJS Configuration
 *
 * Edit this file to customize your app.
 * @see https://chatjs.dev/docs/reference/config
 */
const config = defineConfig({
  ai: {
    anonymousModels: ["openai/gpt-5-nano"],
    disabledModels: [],
    gateway: "vercel",
    providerOrder: [
      "openai",
      "anthropic",
      "google",
      "xai",
      "meta",
      "mistral",
      "deepseek",
      "perplexity",
      "cohere",
      "alibaba",
      "amazon",
      "inception",
      "moonshot",
      "morph",
      "zai",
    ],
    tools: {
      code: {
        edits: "openai/gpt-5-mini",
      },
      deepResearch: {
        allowClarification: true,
        defaultModel: "openai/gpt-5-nano",
        finalReportModel: "openai/gpt-5-mini",
        maxConcurrentResearchUnits: 2,
        maxResearcherIterations: 1,
        maxSearchQueries: 2,
      },
      followupSuggestions: {
        enabled: true,
      },
      image: {
        default: "google/gemini-3-pro-image",
      },
      sheet: {
        analyze: "openai/gpt-5-mini",
        format: "openai/gpt-5-mini",
      },
      text: {
        polish: "openai/gpt-5-mini",
      },
    },
    workflows: {
      chatImageCompatible: "openai/gpt-4o-mini",
    },
  },
  anonymous: {
    availableTools: [],
    // oxlint-disable-next-line no-ternary -- Keep credits as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
    credits: isProd
      ? PRODUCTION_ANONYMOUS_CREDITS
      : DEVELOPMENT_ANONYMOUS_CREDITS,
    rateLimit: {
      // oxlint-disable-next-line no-ternary -- Keep requestsPerMinute as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
      requestsPerMinute: isProd
        ? PRODUCTION_REQUESTS_PER_MINUTE
        : DEVELOPMENT_REQUESTS_PER_MINUTE,
      // oxlint-disable-next-line no-ternary -- Keep requestsPerMonth as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
      requestsPerMonth: isProd
        ? PRODUCTION_REQUESTS_PER_MONTH
        : DEVELOPMENT_REQUESTS_PER_MONTH,
    },
  },
  appDescription:
    "Build and deploy AI chat applications in minutes. ChatJS provides authentication, streaming, tool calling, and all the features you need for production-ready AI conversations.",
  appName: "ChatJS",
  appPrefix: "chatjs",
  appTitle: "ChatJS - The prod ready AI chat app",
  appUrl: "https://www.demo.chatjs.dev",
  attachments: {
    acceptedTypes: {
      "application/pdf": [".pdf"],
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
    },
    // 1MB
    maxBytes: MAX_ATTACHMENT_BYTES,
    maxDimension: 2048,
  },
  authentication: {
    // Requires AUTH_GITHUB_ID + AUTH_GITHUB_SECRET
    github: true,
    // Requires AUTH_GOOGLE_ID + AUTH_GOOGLE_SECRET
    google: true,
    // Requires VERCEL_APP_CLIENT_ID + VERCEL_APP_CLIENT_SECRET
    vercel: true,
  },
  desktopApp: {
    enabled: true,
  },
  features: {
    parallelResponses: true,
  },
  legal: {
    governingLaw: "United States",
    minimumAge: 13,
    refundPolicy: "no-refunds",
  },
  organization: {
    contact: {
      legalEmail: "legal@chatjs.dev",
      privacyEmail: "privacy@chatjs.dev",
    },
    name: "ChatJS",
  },
  policies: {
    privacy: {
      lastUpdated: "July 24, 2025",
      title: "Privacy Policy",
    },
    terms: {
      lastUpdated: "July 24, 2025",
      title: "Terms of Service",
    },
  },
  services: {
    aiProviders: [
      "OpenAI",
      "Anthropic",
      "xAI",
      "Google",
      "Meta",
      "Mistral",
      "Alibaba",
      "Amazon",
      "Cohere",
      "DeepSeek",
      "Perplexity",
      "Vercel",
      "Inception",
      "Moonshot",
      "Morph",
      "ZAI",
    ],
    hosting: "Vercel",
    paymentProcessors: [],
  },
});
/* oxlint-disable import/no-default-export --
 * import/no-default-export (#526): lib/config.ts imports this user-editable configuration by its existing default export; changing that module contract requires a public template migration.
 */
export default config;
/* oxlint-enable import/no-default-export */
