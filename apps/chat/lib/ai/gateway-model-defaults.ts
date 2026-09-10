import type { GatewayModelDefaults } from "@chat-js/gateways/defaults";
import type { Gateway } from "./gateway";

export const gatewayType = "vercel" satisfies InstanceType<
  typeof Gateway
>["type"];
export const gatewayModelDefaults = {
  anonymousModels: ["google/gemini-2.5-flash-lite", "openai/gpt-5-nano"],
  curatedDefaults: [
    "openai/gpt-5-nano",
    "openai/gpt-5-mini",
    "openai/gpt-5.2",
    "google/gemini-2.5-flash-lite",
    "google/gemini-3-flash",
    "google/gemini-3.1-pro-preview",
    "anthropic/claude-sonnet-4.5",
    "anthropic/claude-opus-4.5",
  ],
  disabledModels: [],
  providerOrder: ["openai", "google", "anthropic"],
  workflows: {
    chat: "openai/gpt-5-mini",
    title: "openai/gpt-5-nano",
    pdf: "openai/gpt-5-mini",
    chatImageCompatible: "openai/gpt-4o-mini",
  },
  tools: {
    webSearch: {
      enabled: false,
    },
    urlRetrieval: {
      enabled: false,
    },
    codeExecution: {
      enabled: false,
    },
    mcp: {
      enabled: false,
    },
    documents: {
      enabled: true,
      types: {
        text: true,
        code: true,
        sheet: true,
      },
    },
    followupSuggestions: {
      enabled: false,
      default: "google/gemini-2.5-flash-lite",
    },
    text: {
      polish: "openai/gpt-5-mini",
    },
    sheet: {
      format: "openai/gpt-5-mini",
      analyze: "openai/gpt-5-mini",
    },
    code: {
      edits: "openai/gpt-5-mini",
    },
    image: {
      enabled: false,
      default: "google/gemini-3-pro-image",
    },
    video: {
      enabled: false,
      default: "xai/grok-imagine-video",
    },
    deepResearch: {
      enabled: false,
      defaultModel: "google/gemini-2.5-flash-lite",
      finalReportModel: "google/gemini-3-flash",
      allowClarification: true,
      maxResearcherIterations: 1,
      maxConcurrentResearchUnits: 2,
      maxSearchQueries: 2,
    },
  },
} satisfies GatewayModelDefaults<InstanceType<typeof Gateway>>;
export const gatewayCapabilities = { image: true, video: true };
export const gatewayEnvRequirements = [
  { options: [["AI_GATEWAY_API_KEY"], ["VERCEL_OIDC_TOKEN"]] },
];
export const gatewayEnvVariables = ["AI_GATEWAY_API_KEY", "VERCEL_OIDC_TOKEN"];
