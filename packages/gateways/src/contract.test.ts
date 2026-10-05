import type {
  Experimental_VideoModelV4,
  LanguageModelV4,
} from "@ai-sdk/provider";
import type { ImageModel } from "ai";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import { describe, expect, it, vi } from "vitest";
/* oxlint-enable sort-imports */

/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { LiteLLMGateway } from "../../registry/src/gateways/litellm/gateway";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { gatewayMetadata } from "../../registry/src/gateways/metadata";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { GatewayType } from "../../registry/src/gateways/metadata";
/* oxlint-enable sort-imports */
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { OpenAICompatibleGateway } from "../../registry/src/gateways/openai-compatible/gateway";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { OpenAIGateway } from "../../registry/src/gateways/openai/gateway";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { OpenRouterGateway } from "../../registry/src/gateways/openrouter/gateway";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { VercelGateway } from "../../registry/src/gateways/vercel/gateway";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import gatewayPackage from "../package.json";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/max-dependencies -- This integration composes its explicit adapters here; splitting the imports would hide the dependency boundary without reducing dependencies. */
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { GatewayProvider } from "./gateway-provider";
/* oxlint-enable sort-imports */
/* oxlint-enable import/max-dependencies */

const OPTIONS_PARAMETER_INDEX = 0;
type AdapterOptions = NonNullable<
  ConstructorParameters<typeof VercelGateway>[typeof OPTIONS_PARAMETER_INDEX]
>;

const callUnsupportedModel = (
  method: (modelId: never) => unknown,
  receiver: object
): null => {
  const result: unknown = Reflect.apply(method, receiver, [
    "unsupported-model",
  ]);
  // Only null is both object-typed and falsy; reject every actual model value.
  if (typeof result !== "object" || result) {
    throw new Error("Unsupported media factory returned a model");
  }
  return result;
};
const adapters: readonly Readonly<{
  name: GatewayType;
  create: (
    options: AdapterOptions
  ) => GatewayProvider<string, never, never, never>;
  env: Readonly<Record<string, string>>;
  createImageModel: (options: AdapterOptions) => ImageModel | null;
  createLanguageModel: (options: AdapterOptions) => LanguageModelV4;
  createVideoModel: (
    options: AdapterOptions
  ) => Experimental_VideoModelV4 | null;
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
    createVideoModel: (options) => {
      const gateway = new OpenAIGateway(options);
      return callUnsupportedModel(
        gateway.createVideoModel.bind(gateway),
        gateway
      );
    },
    env: { OPENAI_API_KEY: "test" },
    image: true,
    name: "openai",
    video: false,
  },
  {
    create: (options) => new OpenRouterGateway(options),
    createImageModel: (options) => {
      const gateway = new OpenRouterGateway(options);
      return callUnsupportedModel(
        gateway.createImageModel.bind(gateway),
        gateway
      );
    },
    createLanguageModel: (options) =>
      new OpenRouterGateway(options).createLanguageModel("openai/gpt-5-mini"),
    createVideoModel: (options) => {
      const gateway = new OpenRouterGateway(options);
      return callUnsupportedModel(
        gateway.createVideoModel.bind(gateway),
        gateway
      );
    },
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
    createVideoModel: (options) => {
      const gateway = new OpenAICompatibleGateway(options);
      return callUnsupportedModel(
        gateway.createVideoModel.bind(gateway),
        gateway
      );
    },
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
    createVideoModel: (options) => {
      const gateway = new LiteLLMGateway(options);
      return callUnsupportedModel(
        gateway.createVideoModel.bind(gateway),
        gateway
      );
    },
    env: { LITELLM_BASE_URL: "https://example.test" },
    image: true,
    name: "litellm",
    video: false,
  },
];

/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */
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
      fetch: vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(null, { status: 503 })),
      getFallbackModels: (name) => {
        requested.push(name);
        return [];
      },
    });
    expect(await gateway.fetchModels()).toEqual([]);
    expect(requested).toEqual([adapter.name]);
  });
});
/* oxlint-enable unicorn/no-null */
