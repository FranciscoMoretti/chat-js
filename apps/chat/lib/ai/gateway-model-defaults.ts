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
  tools: {
    code: {
      edits: "openai/gpt-5-mini",
    },
    codeExecution: {
      enabled: false,
    },
    deepResearch: {
      allowClarification: true,
      defaultModel: "google/gemini-2.5-flash-lite",
      enabled: false,
      finalReportModel: "google/gemini-3-flash",
      maxConcurrentResearchUnits: 2,
      maxResearcherIterations: 1,
      maxSearchQueries: 2,
    },
    documents: {
      enabled: true,
      types: {
        code: true,
        sheet: true,
        text: true,
      },
    },
    followupSuggestions: {
      default: "google/gemini-2.5-flash-lite",
      enabled: false,
    },
    image: {
      default: "google/gemini-3-pro-image",
      enabled: false,
    },
    mcp: {
      enabled: false,
    },
    sheet: {
      analyze: "openai/gpt-5-mini",
      format: "openai/gpt-5-mini",
    },
    text: {
      polish: "openai/gpt-5-mini",
    },
    urlRetrieval: {
      enabled: false,
    },
    video: {
      default: "xai/grok-imagine-video",
      enabled: false,
    },
    webSearch: {
      enabled: false,
    },
  },
  workflows: {
    chat: "openai/gpt-5-mini",
    chatImageCompatible: "openai/gpt-4o-mini",
    pdf: "openai/gpt-5-mini",
    title: "openai/gpt-5-nano",
  },
} satisfies GatewayModelDefaults<InstanceType<typeof Gateway>>;
export const gatewayCapabilities = { image: true, video: true };
export const gatewayEnvRequirements = [
  { options: [["AI_GATEWAY_API_KEY"], ["VERCEL_OIDC_TOKEN"]] },
];
export const gatewayEnvVariables = ["AI_GATEWAY_API_KEY", "VERCEL_OIDC_TOKEN"];
