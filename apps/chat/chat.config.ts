import { defineConfig } from "@/lib/config-schema";

const isProd = process.env.NODE_ENV === "production";
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
      codeExecution: {
        // Vercel-native, no key needed
        enabled: true,
      },
      deepResearch: {
        allowClarification: true,
        defaultModel: "openai/gpt-5-nano",
        // Requires webSearch
        enabled: true,
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
        // Requires BLOB_READ_WRITE_TOKEN
        enabled: true,
      },
      mcp: {
        // Requires MCP_ENCRYPTION_KEY
        enabled: true,
      },
      sheet: {
        analyze: "openai/gpt-5-mini",
        format: "openai/gpt-5-mini",
      },
      text: {
        polish: "openai/gpt-5-mini",
      },
      urlRetrieval: {
        // Requires the selected URL retrieval tool’s credentials
        enabled: true,
      },
      webSearch: {
        // Requires TAVILY_API_KEY or FIRECRAWL_API_KEY
        enabled: true,
      },
    },
    workflows: {
      chatImageCompatible: "openai/gpt-4o-mini",
    },
  },
  anonymous: {
    availableTools: [],
    credits: isProd ? 10 : 1000,
    rateLimit: {
      requestsPerMinute: isProd ? 5 : 60,
      requestsPerMonth: isProd ? 10 : 1000,
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
    maxBytes: 1024 * 1024,
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
    // Requires BLOB_READ_WRITE_TOKEN
    attachments: true,
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
export default config;
