import { describe, expect, it, vi } from "vitest";

import { LiteLLMGateway } from "../../registry/src/gateways/litellm/gateway";
import { OpenAICompatibleGateway } from "../../registry/src/gateways/openai-compatible/gateway";
import { OpenAIGateway } from "../../registry/src/gateways/openai/gateway";
import { OpenRouterGateway } from "../../registry/src/gateways/openrouter/gateway";
import { VercelGateway } from "../../registry/src/gateways/vercel/gateway";
import { gatewayMetadata } from "../../registry/src/gateways/metadata";
import gatewayPackage from "../package.json";

const OPTIONS_PARAMETER_INDEX = 0;
type AdapterOptions = NonNullable<
  ConstructorParameters<typeof VercelGateway>[typeof OPTIONS_PARAMETER_INDEX]
>;
type GatewayInstance =
  | InstanceType<typeof LiteLLMGateway>
  | InstanceType<typeof OpenAICompatibleGateway>
  | InstanceType<typeof OpenAIGateway>
  | InstanceType<typeof OpenRouterGateway>
  | InstanceType<typeof VercelGateway>;

const adapters: readonly Readonly<{
  name: keyof typeof gatewayMetadata;
  create: (options: AdapterOptions) => GatewayInstance;
  env: Readonly<Record<string, string>>;
  createImageModel: (
    options: AdapterOptions
  ) => ReturnType<NonNullable<GatewayInstance["createImageModel"]>> | null;
  createLanguageModel: (
    options: AdapterOptions
  ) => ReturnType<GatewayInstance["createLanguageModel"]>;
  createVideoModel: (
    options: AdapterOptions
  ) => ReturnType<NonNullable<GatewayInstance["createVideoModel"]>> | null;
  image: boolean;
  video: boolean;
}>[] = [
  {
    create: (options) => new VercelGateway(options),
    createImageModel: (options) =>
      new VercelGateway(options).createImageModel("openai/gpt-image-1"),
    createLanguageModel: (options) =>
      new VercelGateway(options).createLanguageModel("openai/gpt-5-mini"),
    createVideoModel: (options) =>
      new VercelGateway(options).createVideoModel("google/veo-3"),
    env: { AI_GATEWAY_API_KEY: "test" },
    image: true,
    name: "vercel",
    video: true,
  },
  {
    create: (options) => new OpenAIGateway(options),
    createImageModel: (options) =>
      new OpenAIGateway(options).createImageModel("dall-e-3"),
    createLanguageModel: (options) =>
      new OpenAIGateway(options).createLanguageModel("gpt-5-mini"),
    createVideoModel: (options) => new OpenAIGateway(options).createVideoModel,
    env: { OPENAI_API_KEY: "test" },
    image: true,
    name: "openai",
    video: false,
  },
  {
    create: (options) => new OpenRouterGateway(options),
    createImageModel: (options) =>
      new OpenRouterGateway(options).createImageModel,
    createLanguageModel: (options) =>
      new OpenRouterGateway(options).createLanguageModel("openai/gpt-5-mini"),
    createVideoModel: (options) =>
      new OpenRouterGateway(options).createVideoModel,
    env: { OPENROUTER_API_KEY: "test" },
    image: false,
    name: "openrouter",
    video: false,
  },
  {
    create: (options) => new OpenAICompatibleGateway(options),
    createImageModel: (options) =>
      new OpenAICompatibleGateway(options).createImageModel(
        "custom-image-model"
      ),
    createLanguageModel: (options) =>
      new OpenAICompatibleGateway(options).createLanguageModel("custom-model"),
    createVideoModel: (options) =>
      new OpenAICompatibleGateway(options).createVideoModel,
    env: { OPENAI_COMPATIBLE_BASE_URL: "https://example.test/v1" },
    image: true,
    name: "openai-compatible",
    video: false,
  },
  {
    create: (options) => new LiteLLMGateway(options),
    createImageModel: (options) =>
      new LiteLLMGateway(options).createImageModel("custom-image-model"),
    createLanguageModel: (options) =>
      new LiteLLMGateway(options).createLanguageModel("custom-model"),
    createVideoModel: (options) => new LiteLLMGateway(options).createVideoModel,
    env: { LITELLM_BASE_URL: "https://example.test" },
    image: true,
    name: "litellm",
    video: false,
  },
];

describe.each(adapters)("$name gateway contract", (adapter) => {
  it("creates AI SDK v4 models and exposes unsupported factories as null", () => {
    const gateway = adapter.create({ env: adapter.env });
    expect(gateway.type).toBe(adapter.name);
    expect(gateway.createImageModel !== null).toBe(adapter.image);
    expect(gateway.createVideoModel !== null).toBe(adapter.video);
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
      fetch: vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(null, { status: 503 })),
      getFallbackModels: (name: string) => {
        requested.push(name);
        return [];
      },
    });
    expect(await gateway.fetchModels()).toEqual([]);
    expect(requested).toEqual([adapter.name]);
  });
});
