import type { GatewayModelDefaults } from "@chat-js/gateways/defaults";
import type { LiteLLMGateway } from "./litellm/gateway.ts";
import type { OpenAIGateway } from "./openai/gateway.ts";
import type { OpenAICompatibleGateway } from "./openai-compatible/gateway.ts";
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
  providerOrder: ["openai", "google", "anthropic"],
  disabledModels: [],
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
  anonymousModels: ["google/gemini-2.5-flash-lite", "openai/gpt-5-nano"],
  workflows: {
    chat: "openai/gpt-5-mini",
    title: "openai/gpt-5-nano",
    pdf: "openai/gpt-5-mini",
    chatImageCompatible: "openai/gpt-4o-mini",
  },
  tools: {
    webSearch: { enabled: false },
    urlRetrieval: { enabled: false },
    codeExecution: { enabled: false },
    mcp: { enabled: false },
    documents: {
      enabled: true,
      types: { text: true, code: true, sheet: true },
    },
    followupSuggestions: {
      enabled: false,
      default: "google/gemini-2.5-flash-lite",
    },
    text: { polish: "openai/gpt-5-mini" },
    sheet: { format: "openai/gpt-5-mini", analyze: "openai/gpt-5-mini" },
    code: { edits: "openai/gpt-5-mini" },
    image: { enabled: false, default: "google/gemini-3-pro-image" },
    video: { enabled: false, default: "xai/grok-imagine-video" },
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
} satisfies GatewayModelDefaults<Gateways["vercel"]>;

const openrouterDefaults = {
  providerOrder: ["openai", "google", "anthropic"],
  disabledModels: [],
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
  anonymousModels: ["google/gemini-2.5-flash-lite", "openai/gpt-5-nano"],
  workflows: {
    chat: "openai/gpt-5-mini",
    title: "openai/gpt-5-nano",
    pdf: "openai/gpt-5-mini",
    chatImageCompatible: "openai/gpt-4o-mini",
  },
  tools: {
    webSearch: { enabled: false },
    urlRetrieval: { enabled: false },
    codeExecution: { enabled: false },
    mcp: { enabled: false },
    documents: {
      enabled: true,
      types: { text: true, code: true, sheet: true },
    },
    followupSuggestions: {
      enabled: false,
      default: "google/gemini-2.5-flash-lite",
    },
    text: { polish: "openai/gpt-5-mini" },
    sheet: { format: "openai/gpt-5-mini", analyze: "openai/gpt-5-mini" },
    code: { edits: "openai/gpt-5-mini" },
    image: { enabled: false },
    video: { enabled: false },
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
} satisfies GatewayModelDefaults<Gateways["openrouter"]>;

const openaiDefaults = {
  providerOrder: ["openai"],
  disabledModels: [],
  curatedDefaults: [
    "gpt-5-nano",
    "gpt-5-mini",
    "gpt-5.2",
    "gpt-5.2-chat-latest",
  ],
  anonymousModels: ["gpt-5-nano"],
  workflows: {
    chat: "gpt-5-mini",
    title: "gpt-5-nano",
    pdf: "gpt-5-mini",
    chatImageCompatible: "gpt-4o-mini",
  },
  tools: {
    webSearch: { enabled: false },
    urlRetrieval: { enabled: false },
    codeExecution: { enabled: false },
    mcp: { enabled: false },
    documents: {
      enabled: true,
      types: { text: true, code: true, sheet: true },
    },
    followupSuggestions: { enabled: false, default: "gpt-5-nano" },
    text: { polish: "gpt-5-mini" },
    sheet: { format: "gpt-5-mini", analyze: "gpt-5-mini" },
    code: { edits: "gpt-5-mini" },
    image: { enabled: false, default: "gpt-image-1" },
    video: { enabled: false },
    deepResearch: {
      enabled: false,
      defaultModel: "gpt-5-nano",
      finalReportModel: "gpt-5-mini",
      allowClarification: true,
      maxResearcherIterations: 1,
      maxConcurrentResearchUnits: 2,
      maxSearchQueries: 2,
    },
  },
} satisfies GatewayModelDefaults<Gateways["openai"]>;

const openaiCompatibleDefaults = {
  ...openaiDefaults,
} satisfies GatewayModelDefaults<Gateways["openai-compatible"]>;

const litellmDefaults = {
  providerOrder: ["openai"],
  disabledModels: [],
  curatedDefaults: [
    "openai/gpt-4o-mini",
    "openai/gpt-4o",
    "openai/gpt-5-mini",
    "openai/gpt-5-nano",
  ],
  anonymousModels: ["openai/gpt-4o-mini"],
  workflows: {
    chat: "openai/gpt-4o-mini",
    title: "openai/gpt-4o-mini",
    pdf: "openai/gpt-4o-mini",
    chatImageCompatible: "openai/gpt-4o-mini",
  },
  tools: {
    webSearch: { enabled: false },
    urlRetrieval: { enabled: false },
    codeExecution: { enabled: false },
    mcp: { enabled: false },
    documents: {
      enabled: true,
      types: { text: true, code: true, sheet: true },
    },
    followupSuggestions: { enabled: false, default: "openai/gpt-4o-mini" },
    text: { polish: "openai/gpt-4o-mini" },
    sheet: { format: "openai/gpt-4o-mini", analyze: "openai/gpt-4o-mini" },
    code: { edits: "openai/gpt-4o-mini" },
    image: { enabled: false },
    video: { enabled: false },
    deepResearch: {
      enabled: false,
      defaultModel: "openai/gpt-4o-mini",
      finalReportModel: "openai/gpt-4o",
      allowClarification: true,
      maxResearcherIterations: 1,
      maxConcurrentResearchUnits: 2,
      maxSearchQueries: 2,
    },
  },
} satisfies GatewayModelDefaults<Gateways["litellm"]>;

// Record ensures a compile error if a new gateway is added but not here.
export const GATEWAY_MODEL_DEFAULTS = {
  vercel: vercelDefaults,
  openrouter: openrouterDefaults,
  openai: openaiDefaults,
  "openai-compatible": openaiCompatibleDefaults,
  litellm: litellmDefaults,
} satisfies { [G in GatewayType]: GatewayModelDefaults<Gateways[G]> };
