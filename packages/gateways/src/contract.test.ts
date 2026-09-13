import type {
  Experimental_VideoModelV4,
  LanguageModelV4,
} from "@ai-sdk/provider";
import type { ImageModel } from "ai";
import { describe, expect, it } from "vitest";

import { LiteLLMGateway } from "../../registry/src/gateways/litellm/gateway";
import { gatewayMetadata } from "../../registry/src/gateways/metadata";
import type { GatewayType } from "../../registry/src/gateways/metadata";
import { OpenAICompatibleGateway } from "../../registry/src/gateways/openai-compatible/gateway";
import { OpenAIGateway } from "../../registry/src/gateways/openai/gateway";
import { OpenRouterGateway } from "../../registry/src/gateways/openrouter/gateway";
import { VercelGateway } from "../../registry/src/gateways/vercel/gateway";
import gatewayPackage from "../package.json";
import type { GatewayProvider } from "./gateway-provider";
import type { GatewayOptions } from "./runtime";

const callUnsupportedModel = <T>(
  method: (modelId: never) => T,
  receiver: object
): T => Reflect.apply(method, receiver, ["unsupported-model"]);

const adapters: {
  name: GatewayType;
  create: (
    options: GatewayOptions
  ) => GatewayProvider<string, never, never, never>;
  env: Record<string, string>;
  createImageModel: (options: GatewayOptions) => ImageModel | null;
  createLanguageModel: (options: GatewayOptions) => LanguageModelV4;
  createVideoModel: (
    options: GatewayOptions
  ) => Experimental_VideoModelV4 | null;
  image: boolean;
  video: boolean;
}[] = [
  {
    create: (o) => new VercelGateway(o),
    createImageModel: (o) =>
      new VercelGateway(o).createImageModel("openai/gpt-image-1"),
    createLanguageModel: (o) =>
      new VercelGateway(o).createLanguageModel("openai/gpt-5-mini"),
    createVideoModel: (o) =>
      new VercelGateway(o).createVideoModel("google/veo-3"),
    env: { AI_GATEWAY_API_KEY: "test" },
    image: true,
    name: "vercel",
    video: true,
  },
  {
    create: (o) => new OpenAIGateway(o),
    createImageModel: (o) => new OpenAIGateway(o).createImageModel("dall-e-3"),
    createLanguageModel: (o) =>
      new OpenAIGateway(o).createLanguageModel("gpt-5-mini"),
    createVideoModel: (o) => {
      const gateway = new OpenAIGateway(o);
      return callUnsupportedModel(gateway.createVideoModel, gateway);
    },
    env: { OPENAI_API_KEY: "test" },
    image: true,
    name: "openai",
    video: false,
  },
  {
    create: (o) => new OpenRouterGateway(o),
    createImageModel: (o) => {
      const gateway = new OpenRouterGateway(o);
      return callUnsupportedModel(gateway.createImageModel, gateway);
    },
    createLanguageModel: (o) =>
      new OpenRouterGateway(o).createLanguageModel("openai/gpt-5-mini"),
    createVideoModel: (o) => {
      const gateway = new OpenRouterGateway(o);
      return callUnsupportedModel(gateway.createVideoModel, gateway);
    },
    env: { OPENROUTER_API_KEY: "test" },
    image: false,
    name: "openrouter",
    video: false,
  },
  {
    create: (o) => new OpenAICompatibleGateway(o),
    createImageModel: (o) =>
      new OpenAICompatibleGateway(o).createImageModel("custom-image-model"),
    createLanguageModel: (o) =>
      new OpenAICompatibleGateway(o).createLanguageModel("custom-model"),
    createVideoModel: (o) => {
      const gateway = new OpenAICompatibleGateway(o);
      return callUnsupportedModel(gateway.createVideoModel, gateway);
    },
    env: { OPENAI_COMPATIBLE_BASE_URL: "https://example.test/v1" },
    image: true,
    name: "openai-compatible",
    video: false,
  },
  {
    create: (o) => new LiteLLMGateway(o),
    createImageModel: (o) =>
      new LiteLLMGateway(o).createImageModel("custom-image-model"),
    createLanguageModel: (o) =>
      new LiteLLMGateway(o).createLanguageModel("custom-model"),
    createVideoModel: (o) => {
      const gateway = new LiteLLMGateway(o);
      return callUnsupportedModel(gateway.createVideoModel, gateway);
    },
    env: { LITELLM_BASE_URL: "https://example.test" },
    image: true,
    name: "litellm",
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
      adapter.createLanguageModel({ env: adapter.env }).specificationVersion
    ).toBe("v4");
    expect(adapter.createImageModel({ env: adapter.env }) !== null).toBe(
      adapter.image
    );
    expect(adapter.createVideoModel({ env: adapter.env }) !== null).toBe(
      adapter.video
    );
  });

  it("uses only the host's fallback snapshot after a discovery failure", async () => {
    const requested: string[] = [];
    const gateway = adapter.create({
      env: adapter.env,
      fetch: () => Promise.resolve(new Response(null, { status: 503 })),
      getFallbackModels: (name) => {
        requested.push(name);
        return [];
      },
    });
    expect(await gateway.fetchModels()).toEqual([]);
    expect(requested).toEqual([adapter.name]);
  });
});
