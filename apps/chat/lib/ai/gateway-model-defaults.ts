import type { GatewayModelDefaults } from "@chat-js/gateways/defaults";
import type { Gateway } from "./gateway";

const gatewayType = "vercel" satisfies InstanceType<typeof Gateway>["type"];
const gatewayModelDefaults = {
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
    balanced: "openai/gpt-5-mini",
    fast: "google/gemini-2.5-flash-lite",
    image: "google/gemini-3-pro-image",
    smart: "google/gemini-3-flash",
    video: "xai/grok-imagine-video",
  },
  workflows: {
    chat: "google/gemini-2.5-flash-lite",
    chatImageCompatible: "openai/gpt-4o-mini",
    pdf: "openai/gpt-5-mini",
    title: "openai/gpt-5-nano",
  },
} satisfies GatewayModelDefaults<InstanceType<typeof Gateway>>;
const gatewayCapabilities = { image: true, video: true };
const gatewayEnvRequirements = [
  { options: [["AI_GATEWAY_API_KEY"], ["VERCEL_OIDC_TOKEN"]] },
];
const gatewayEnvVariables = ["AI_GATEWAY_API_KEY", "VERCEL_OIDC_TOKEN"];
export {
  gatewayType,
  gatewayModelDefaults,
  gatewayCapabilities,
  gatewayEnvRequirements,
  gatewayEnvVariables,
};
