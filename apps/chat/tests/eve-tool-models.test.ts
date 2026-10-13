import type { GatewayProvider } from "@chat-js/gateways/gateway-provider";
import { describe, expect, it, vi } from "vitest";

import { LiteLLMGateway } from "../../../packages/registry/src/gateways/litellm/gateway";
import { OpenAICompatibleGateway } from "../../../packages/registry/src/gateways/openai-compatible/gateway";
import { OpenAIGateway } from "../../../packages/registry/src/gateways/openai/gateway";
import { OpenRouterGateway } from "../../../packages/registry/src/gateways/openrouter/gateway";
import { VercelGateway } from "../../../packages/registry/src/gateways/vercel/gateway";
import { eveToolModelProvider } from "../lib/eve/tool-models";

const { getActiveGateway } = vi.hoisted(() => ({
  getActiveGateway: vi.fn<() => GatewayProvider>(),
}));

vi.mock("../lib/ai/active-gateway", () => ({ getActiveGateway }));
vi.mock("../lib/eve/model-selection", () => ({
  loadEveModelDefinition: vi.fn(),
}));

describe.each([
  new OpenAIGateway({ env: { OPENAI_API_KEY: "test" } }),
  new OpenRouterGateway({ env: { OPENROUTER_API_KEY: "test" } }),
  new OpenAICompatibleGateway({
    env: { OPENAI_COMPATIBLE_BASE_URL: "https://example.test/v1" },
  }),
  new LiteLLMGateway({ env: { LITELLM_BASE_URL: "https://example.test" } }),
])("$type unsupported video", (gateway) => {
  it("rejects runtime model IDs with the gateway's descriptive error", () => {
    getActiveGateway.mockReturnValue(gateway);
    expect(() =>
      eveToolModelProvider.createVideoModel("runtime-video")
    ).toThrow(`Gateway '${gateway.type}' does not support video models.`);
  });
});

it("rejects dedicated OpenRouter images and preserves multimodal generation", () => {
  getActiveGateway.mockReturnValue(
    new OpenRouterGateway({ env: { OPENROUTER_API_KEY: "test" } })
  );
  const message =
    "Gateway 'openrouter' does not support dedicated image models. Use a multimodal language model instead.";
  expect(() => eveToolModelProvider.createImageModel("runtime-image")).toThrow(
    message
  );
  expect(
    eveToolModelProvider.createLanguageModel("google/gemini-image")
  ).toMatchObject({
    modelId: "google/gemini-image",
    specificationVersion: "v4",
  });
});

it("calls supported factories with their gateway receiver and runtime ID", () => {
  getActiveGateway.mockReturnValue(
    new VercelGateway({ env: { AI_GATEWAY_API_KEY: "test" } })
  );
  expect(
    eveToolModelProvider.createImageModel("openai/gpt-image-1")
  ).toMatchObject({
    modelId: "openai/gpt-image-1",
    specificationVersion: "v4",
  });
  expect(eveToolModelProvider.createVideoModel("google/veo-3")).toMatchObject({
    modelId: "google/veo-3",
    specificationVersion: "v4",
  });
});
