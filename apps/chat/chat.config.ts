import { defineConfig } from "@/lib/config-schema";

const MAX_ATTACHMENT_BYTES = 1_048_576;

/**
 * ChatJS Configuration
 *
 * Edit this file to customize your app.
 * @see https://chatjs.dev/docs/reference/config
 */
const config = defineConfig({
  ai: {
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
      followupSuggestions: {
        enabled: true,
      },
      image: {
        default: "google/gemini-3-pro-image",
      },
    },
    workflows: {
      chatImageCompatible: "openai/gpt-4o-mini",
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
  features: {
    parallelResponses: true,
  },
});
export default config;
