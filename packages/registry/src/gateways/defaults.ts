import type { GatewayModelDefaults } from "@chat-js/gateways/defaults";

import type { LiteLLMGateway } from "./litellm/gateway.ts";
import type { OpenAICompatibleGateway } from "./openai-compatible/gateway.ts";
import type { OpenAIGateway } from "./openai/gateway.ts";
import type { OpenRouterGateway } from "./openrouter/gateway.ts";
import type { VercelGateway } from "./vercel/gateway.ts";

type Gateways = {
  vercel: VercelGateway;
  openai: OpenAIGateway;
  "openai-compatible": OpenAICompatibleGateway;
  openrouter: OpenRouterGateway;
  litellm: LiteLLMGateway;
};
type GatewayType = keyof Gateways;
const vercelDefaults = {
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
    code: { edits: "openai/gpt-5-mini" },
    codeExecution: { enabled: false },
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
      types: { code: true, sheet: true, text: true },
    },
    followupSuggestions: {
      default: "google/gemini-2.5-flash-lite",
      enabled: false,
    },
    image: { default: "google/gemini-3-pro-image", enabled: false },
    mcp: { enabled: false },
    sheet: { analyze: "openai/gpt-5-mini", format: "openai/gpt-5-mini" },
    text: { polish: "openai/gpt-5-mini" },
    urlRetrieval: { enabled: false },
    video: { default: "xai/grok-imagine-video", enabled: false },
    webSearch: { enabled: false },
  },
  workflows: {
    chat: "openai/gpt-5-mini",
    chatImageCompatible: "openai/gpt-4o-mini",
    pdf: "openai/gpt-5-mini",
    title: "openai/gpt-5-nano",
  },
} satisfies GatewayModelDefaults<Gateways["vercel"]>;

const openrouterDefaults = {
  anonymousModels: ["google/gemini-2.5-flash-lite", "openai/gpt-5-nano"],
  curatedDefaults: [
    "openai/gpt-5-nano",
    "openai/gpt-5-mini",
    "openai/gpt-5.2",
    "openai/gpt-5.2-chat",
    "google/gemini-2.5-flash-lite",
    "google/gemini-3-flash",
    "google/gemini-3-pro-preview",
    "anthropic/claude-sonnet-4.5",
    "anthropic/claude-opus-4.5",
    "xai/grok-4",
  ],
  disabledModels: [],
  providerOrder: ["openai", "google", "anthropic"],
  tools: {
    code: { edits: "openai/gpt-5-mini" },
    codeExecution: { enabled: false },
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
      types: { code: true, sheet: true, text: true },
    },
    followupSuggestions: {
      default: "google/gemini-2.5-flash-lite",
      enabled: false,
    },
    image: { enabled: false },
    mcp: { enabled: false },
    sheet: { analyze: "openai/gpt-5-mini", format: "openai/gpt-5-mini" },
    text: { polish: "openai/gpt-5-mini" },
    urlRetrieval: { enabled: false },
    video: { enabled: false },
    webSearch: { enabled: false },
  },
  workflows: {
    chat: "openai/gpt-5-mini",
    chatImageCompatible: "openai/gpt-4o-mini",
    pdf: "openai/gpt-5-mini",
    title: "openai/gpt-5-nano",
  },
} satisfies GatewayModelDefaults<Gateways["openrouter"]>;

const openaiDefaults = {
  anonymousModels: ["gpt-5-nano"],
  curatedDefaults: [
    "gpt-5-nano",
    "gpt-5-mini",
    "gpt-5.2",
    "gpt-5.2-chat-latest",
  ],
  disabledModels: [],
  providerOrder: ["openai"],
  tools: {
    code: { edits: "gpt-5-mini" },
    codeExecution: { enabled: false },
    deepResearch: {
      allowClarification: true,
      defaultModel: "gpt-5-nano",
      enabled: false,
      finalReportModel: "gpt-5-mini",
      maxConcurrentResearchUnits: 2,
      maxResearcherIterations: 1,
      maxSearchQueries: 2,
    },
    documents: {
      enabled: true,
      types: { code: true, sheet: true, text: true },
    },
    followupSuggestions: { default: "gpt-5-nano", enabled: false },
    image: { default: "gpt-image-1", enabled: false },
    mcp: { enabled: false },
    sheet: { analyze: "gpt-5-mini", format: "gpt-5-mini" },
    text: { polish: "gpt-5-mini" },
    urlRetrieval: { enabled: false },
    video: { enabled: false },
    webSearch: { enabled: false },
  },
  workflows: {
    chat: "gpt-5-mini",
    chatImageCompatible: "gpt-4o-mini",
    pdf: "gpt-5-mini",
    title: "gpt-5-nano",
  },
} satisfies GatewayModelDefaults<Gateways["openai"]>;

const openaiCompatibleDefaults = {
  ...openaiDefaults,
} satisfies GatewayModelDefaults<Gateways["openai-compatible"]>;

const litellmDefaults = {
  anonymousModels: ["openai/gpt-4o-mini"],
  curatedDefaults: [
    "openai/gpt-4o-mini",
    "openai/gpt-4o",
    "openai/gpt-5-mini",
    "openai/gpt-5-nano",
  ],
  disabledModels: [],
  providerOrder: ["openai"],
  tools: {
    code: { edits: "openai/gpt-4o-mini" },
    codeExecution: { enabled: false },
    deepResearch: {
      allowClarification: true,
      defaultModel: "openai/gpt-4o-mini",
      enabled: false,
      finalReportModel: "openai/gpt-4o",
      maxConcurrentResearchUnits: 2,
      maxResearcherIterations: 1,
      maxSearchQueries: 2,
    },
    documents: {
      enabled: true,
      types: { code: true, sheet: true, text: true },
    },
    followupSuggestions: { default: "openai/gpt-4o-mini", enabled: false },
    image: { enabled: false },
    mcp: { enabled: false },
    sheet: { analyze: "openai/gpt-4o-mini", format: "openai/gpt-4o-mini" },
    text: { polish: "openai/gpt-4o-mini" },
    urlRetrieval: { enabled: false },
    video: { enabled: false },
    webSearch: { enabled: false },
  },
  workflows: {
    chat: "openai/gpt-4o-mini",
    chatImageCompatible: "openai/gpt-4o-mini",
    pdf: "openai/gpt-4o-mini",
    title: "openai/gpt-4o-mini",
  },
} satisfies GatewayModelDefaults<Gateways["litellm"]>;

// Record ensures a compile error if a new gateway is added but not here.
export const GATEWAY_MODEL_DEFAULTS = {
  litellm: litellmDefaults,
  openai: openaiDefaults,
  "openai-compatible": openaiCompatibleDefaults,
  openrouter: openrouterDefaults,
  vercel: vercelDefaults,
} satisfies { [G in GatewayType]: GatewayModelDefaults<Gateways[G]> };
