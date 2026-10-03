import type { GatewayModelDefaults } from "@chat-js/gateways/defaults";

import type { LiteLLMGateway } from "./litellm/gateway.ts";
import type { OpenAICompatibleGateway } from "./openai-compatible/gateway.ts";
import type { OpenAIGateway } from "./openai/gateway.ts";
import type { OpenRouterGateway } from "./openrouter/gateway.ts";
import type { VercelGateway } from "./vercel/gateway.ts";

/* oxlint-disable typescript/consistent-type-definitions -- Keep this structural alias closed to declaration merging and compatible with the existing generic/record API. */
type Gateways = {
  vercel: VercelGateway;
  openai: OpenAIGateway;
  "openai-compatible": OpenAICompatibleGateway;
  openrouter: OpenRouterGateway;
  litellm: LiteLLMGateway;
};
/* oxlint-enable typescript/consistent-type-definitions */
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
    deepResearch: {
      allowClarification: true,
      defaultModel: "google/gemini-2.5-flash-lite",
      finalReportModel: "google/gemini-3-flash",
      maxConcurrentResearchUnits: 2,
      maxResearcherIterations: 1,
      maxSearchQueries: 2,
    },
    followupSuggestions: {
      default: "google/gemini-2.5-flash-lite",
      enabled: false,
    },
    image: { default: "google/gemini-3-pro-image" },
    sheet: { analyze: "openai/gpt-5-mini", format: "openai/gpt-5-mini" },
    text: { polish: "openai/gpt-5-mini" },
    video: { default: "xai/grok-imagine-video" },
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
    deepResearch: {
      allowClarification: true,
      defaultModel: "google/gemini-2.5-flash-lite",
      finalReportModel: "google/gemini-3-flash",
      maxConcurrentResearchUnits: 2,
      maxResearcherIterations: 1,
      maxSearchQueries: 2,
    },
    followupSuggestions: {
      default: "google/gemini-2.5-flash-lite",
      enabled: false,
    },
    image: {},
    sheet: { analyze: "openai/gpt-5-mini", format: "openai/gpt-5-mini" },
    text: { polish: "openai/gpt-5-mini" },
    video: {},
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
    deepResearch: {
      allowClarification: true,
      defaultModel: "gpt-5-nano",
      finalReportModel: "gpt-5-mini",
      maxConcurrentResearchUnits: 2,
      maxResearcherIterations: 1,
      maxSearchQueries: 2,
    },
    followupSuggestions: { default: "gpt-5-nano", enabled: false },
    image: { default: "gpt-image-1" },
    sheet: { analyze: "gpt-5-mini", format: "gpt-5-mini" },
    text: { polish: "gpt-5-mini" },
    video: {},
  },
  workflows: {
    chat: "gpt-5-mini",
    chatImageCompatible: "gpt-4o-mini",
    pdf: "gpt-5-mini",
    title: "gpt-5-nano",
  },
} satisfies GatewayModelDefaults<Gateways["openai"]>;

/* oxlint-disable oxc/no-rest-spread-properties -- Copying these properties preserves immutable updates and the existing structural API without mutating the source object. */
const openaiCompatibleDefaults = {
  ...openaiDefaults,
} satisfies GatewayModelDefaults<Gateways["openai-compatible"]>;
/* oxlint-enable oxc/no-rest-spread-properties */

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
    deepResearch: {
      allowClarification: true,
      defaultModel: "openai/gpt-4o-mini",
      finalReportModel: "openai/gpt-4o",
      maxConcurrentResearchUnits: 2,
      maxResearcherIterations: 1,
      maxSearchQueries: 2,
    },
    followupSuggestions: { default: "openai/gpt-4o-mini", enabled: false },
    image: {},
    sheet: { analyze: "openai/gpt-4o-mini", format: "openai/gpt-4o-mini" },
    text: { polish: "openai/gpt-4o-mini" },
    video: {},
  },
  workflows: {
    chat: "openai/gpt-4o-mini",
    chatImageCompatible: "openai/gpt-4o-mini",
    pdf: "openai/gpt-4o-mini",
    title: "openai/gpt-4o-mini",
  },
} satisfies GatewayModelDefaults<Gateways["litellm"]>;

/* oxlint-disable import/prefer-default-export -- Keep the named import contract used by registry consumers and package callers even when this module exposes one value. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
/* oxlint-disable eslint/id-length -- Short callback indices and coordinate keys match the surrounding collection or external data shape; renaming public keys would change the contract. */
// Record ensures a compile error if a new gateway is added but not here.
export const GATEWAY_MODEL_DEFAULTS = {
  litellm: litellmDefaults,
  openai: openaiDefaults,
  "openai-compatible": openaiCompatibleDefaults,
  openrouter: openrouterDefaults,
  vercel: vercelDefaults,
} satisfies { [G in GatewayType]: GatewayModelDefaults<Gateways[G]> };
/* oxlint-enable eslint/id-length */
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/prefer-default-export */
