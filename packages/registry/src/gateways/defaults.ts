import type { GatewayModelDefaults } from "@chat-js/gateways/defaults";

import type { LiteLLMGateway } from "./litellm/gateway.ts";
import type { OpenAICompatibleGateway } from "./openai-compatible/gateway.ts";
import type { OpenAIGateway } from "./openai/gateway.ts";
import type { OpenRouterGateway } from "./openrouter/gateway.ts";
import type { VercelGateway } from "./vercel/gateway.ts";

interface Gateways {
  vercel: VercelGateway;
  openai: OpenAIGateway;
  "openai-compatible": OpenAICompatibleGateway;
  openrouter: OpenRouterGateway;
  litellm: LiteLLMGateway;
}
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
  roles: {
    fast: "google/gemini-2.5-flash-lite",
    balanced: "openai/gpt-5-mini",
    smart: "google/gemini-3-flash",
    image: "google/gemini-3-pro-image",
    video: "xai/grok-imagine-video",
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
  roles: {
    fast: "google/gemini-2.5-flash-lite",
    balanced: "openai/gpt-5-mini",
    smart: "google/gemini-3-flash",
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
  roles: {
    fast: "gpt-5-nano",
    balanced: "gpt-5-mini",
    smart: "gpt-5-mini",
    image: "gpt-image-1",
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
  roles: {
    fast: "openai/gpt-4o-mini",
    balanced: "openai/gpt-4o-mini",
    smart: "openai/gpt-4o",
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
} satisfies {
  [Gateway in GatewayType]: GatewayModelDefaults<Gateways[Gateway]>;
};
