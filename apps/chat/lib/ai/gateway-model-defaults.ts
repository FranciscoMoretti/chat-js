import type {
  GatewayImageModelIdMap,
  GatewayModelIdMap,
  GatewayType,
  GatewayVideoModelIdMap,
} from "./gateways/registry";

type VideoDefault<G extends GatewayType> = [GatewayVideoModelIdMap[G]] extends [
  never,
]
  ? { enabled: false }
  :
      | { enabled: true; default: GatewayVideoModelIdMap[G] }
      | { enabled: false; default?: GatewayVideoModelIdMap[G] };

type ImageDefault<G extends GatewayType> = [GatewayImageModelIdMap[G]] extends [
  never,
]
  ? { enabled: false }
  :
      | { enabled: true; default: GatewayImageModelIdMap[G] }
      | { enabled: false; default?: GatewayImageModelIdMap[G] };

export interface ModelDefaultsFor<G extends GatewayType> {
  anonymousModels: GatewayModelIdMap[G][];
  curatedDefaults: GatewayModelIdMap[G][];
  disabledModels: GatewayModelIdMap[G][];
  providerOrder: string[];
  tools: {
    webSearch: { enabled: boolean };
    urlRetrieval: { enabled: boolean };
    codeExecution: { enabled: boolean };
    mcp: { enabled: boolean };
    followupSuggestions: { enabled: boolean; default: GatewayModelIdMap[G] };
    text: { polish: GatewayModelIdMap[G] };
    sheet: { format: GatewayModelIdMap[G]; analyze: GatewayModelIdMap[G] };
    code: { edits: GatewayModelIdMap[G] };
    image: ImageDefault<G>;
    video: VideoDefault<G>;
    deepResearch: {
      enabled: boolean;
      defaultModel: GatewayModelIdMap[G];
      finalReportModel: GatewayModelIdMap[G];
      allowClarification: boolean;
      maxResearcherIterations: number;
      maxConcurrentResearchUnits: number;
      maxSearchQueries: number;
    };
  };
  workflows: {
    chat: GatewayModelIdMap[G];
    title: GatewayModelIdMap[G];
    pdf: GatewayModelIdMap[G];
    chatImageCompatible: GatewayModelIdMap[G];
  };
}

const vercelDefaults = {
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
} satisfies ModelDefaultsFor<"vercel">;

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
} satisfies ModelDefaultsFor<"openrouter">;

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
    followupSuggestions: { enabled: false, default: "gpt-5-nano" },
    text: { polish: "gpt-5-mini" },
    sheet: { format: "gpt-5-mini", analyze: "gpt-5-mini" },
    code: { edits: "gpt-5-mini" },
    image: { enabled: false },
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
} satisfies ModelDefaultsFor<"openai">;

const openaiCompatibleDefaults = {
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
    followupSuggestions: { enabled: false, default: "gpt-5-nano" },
    text: { polish: "gpt-5-mini" },
    sheet: { format: "gpt-5-mini", analyze: "gpt-5-mini" },
    code: { edits: "gpt-5-mini" },
    image: { enabled: false },
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
} satisfies ModelDefaultsFor<"openai-compatible">;

// Record ensures a compile error if a new gateway is added but not here.
export const GATEWAY_MODEL_DEFAULTS: {
  [G in GatewayType]: ModelDefaultsFor<G>;
} = {
  vercel: vercelDefaults,
  openrouter: openrouterDefaults,
  openai: openaiDefaults,
  "openai-compatible": openaiCompatibleDefaults,
};
