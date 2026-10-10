import { describe, expect, it, vi } from "vitest";

/* oxlint-disable import/no-relative-parent-imports -- This monorepo contract test imports the unexported Registry adapter source directly; the test file is excluded from published gateway artifacts. */
import { LiteLLMGateway } from "../../registry/src/gateways/litellm/gateway";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- This monorepo contract test imports unexported Registry source; the test file is excluded from published gateway artifacts. */
import { OpenAICompatibleGateway } from "../../registry/src/gateways/openai-compatible/gateway";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- This monorepo contract test imports unexported Registry adapter source; the test file is excluded from the published gateway package. */
import { OpenAIGateway } from "../../registry/src/gateways/openai/gateway";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- This monorepo contract test imports unexported Registry adapter source; the test file is excluded from the published gateway package. */
import { OpenRouterGateway } from "../../registry/src/gateways/openrouter/gateway";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- This monorepo contract test imports unexported Registry adapter source; the test file is excluded from the published gateway package. */
import { VercelGateway } from "../../registry/src/gateways/vercel/gateway";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- This monorepo contract test inspects unexported Registry metadata source; the test file is excluded from published gateway artifacts. */
import { gatewayMetadata } from "../../registry/src/gateways/metadata";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- Read this package’s own manifest to verify its published exports; the source contract test is excluded from published gateway artifacts. */
import gatewayPackage from "../package.json";
/* oxlint-enable import/no-relative-parent-imports */

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
  name: keyof typeof gatewayMetadata;
  create: (options: AdapterOptions) => GatewayInstance;
  env: Readonly<Record<string, string>>;
  createImageModel: (
    options: AdapterOptions
  ) => ReturnType<GatewayInstance["createImageModel"]>;
  createLanguageModel: (
    options: AdapterOptions
  ) => ReturnType<GatewayInstance["createLanguageModel"]>;
  createVideoModel: (
    options: AdapterOptions
  ) => ReturnType<GatewayInstance["createVideoModel"]>;
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

  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
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
  /* oxlint-enable oxc/no-async-await */
});
/* oxlint-enable unicorn/no-null */
