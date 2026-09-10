import { describe, expect, it } from "vitest";
import { LiteLLMGateway } from "../../registry/src/gateways/litellm/gateway";
import {
  type GatewayType,
  gatewayMetadata,
} from "../../registry/src/gateways/metadata";
import { OpenAIGateway } from "../../registry/src/gateways/openai/gateway";
import { OpenAICompatibleGateway } from "../../registry/src/gateways/openai-compatible/gateway";
import { OpenRouterGateway } from "../../registry/src/gateways/openrouter/gateway";
import { VercelGateway } from "../../registry/src/gateways/vercel/gateway";
import gatewayPackage from "../package.json";
import type { GatewayProvider } from "./gateway-provider";
import type { GatewayOptions } from "./runtime";

const adapters: Array<{
  name: GatewayType;
  create: (options: GatewayOptions) => GatewayProvider;
  env: Record<string, string>;
  model: string;
  image: boolean;
  video: boolean;
}> = [
  {
    name: "vercel",
    create: (o) => new VercelGateway(o),
    env: { AI_GATEWAY_API_KEY: "test" },
    model: "openai/gpt-5-mini",
    image: true,
    video: true,
  },
  {
    name: "openai",
    create: (o) => new OpenAIGateway(o),
    env: { OPENAI_API_KEY: "test" },
    model: "gpt-5-mini",
    image: true,
    video: false,
  },
  {
    name: "openrouter",
    create: (o) => new OpenRouterGateway(o),
    env: { OPENROUTER_API_KEY: "test" },
    model: "openai/gpt-5-mini",
    image: false,
    video: false,
  },
  {
    name: "openai-compatible",
    create: (o) => new OpenAICompatibleGateway(o),
    env: { OPENAI_COMPATIBLE_BASE_URL: "https://example.test/v1" },
    model: "custom-model",
    image: true,
    video: false,
  },
  {
    name: "litellm",
    create: (o) => new LiteLLMGateway(o),
    env: { LITELLM_BASE_URL: "https://example.test" },
    model: "custom-model",
    image: true,
    video: false,
  },
];

describe.each(adapters)("$name gateway contract", (adapter) => {
  it("creates AI SDK v4 models and reports unsupported media as null", () => {
    const gateway = adapter.create({ env: adapter.env });
    expect(gateway.type).toBe(adapter.name);
    expect(adapter.video).toBe(gatewayMetadata[adapter.name].supportsVideo);
    const { dependency, version } = gatewayMetadata[adapter.name];
    expect(gatewayPackage.devDependencies[dependency]).toBe(version);
    expect(
      gateway.createLanguageModel(adapter.model).specificationVersion,
    ).toBe("v4");
    expect(gateway.createImageModel("test-image") !== null).toBe(adapter.image);
    expect(gateway.createVideoModel("test-video") !== null).toBe(adapter.video);
  });

  it("uses only the host's fallback snapshot after a discovery failure", async () => {
    const requested: string[] = [];
    const gateway = adapter.create({
      env: adapter.env,
      fetch: async () => new Response(null, { status: 503 }),
      getFallbackModels: (name) => {
        requested.push(name);
        return [];
      },
    });
    expect(await gateway.fetchModels()).toEqual([]);
    expect(requested).toEqual([adapter.name]);
  });
});
