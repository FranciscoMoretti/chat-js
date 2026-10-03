import type {
  Experimental_VideoModelV4,
  LanguageModelV4,
} from "@ai-sdk/provider";
import type { ImageModel } from "ai";
import { describe, expect, it } from "vitest";

/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { LiteLLMGateway } from "../../registry/src/gateways/litellm/gateway";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { gatewayMetadata } from "../../registry/src/gateways/metadata";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import type { GatewayType } from "../../registry/src/gateways/metadata";
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
import type { GatewayProvider } from "./gateway-provider";
/* oxlint-enable import/max-dependencies */
import type { GatewayOptions } from "./runtime";

/* oxlint-disable eslint/id-length -- Short callback indices and coordinate keys match the surrounding collection or external data shape; renaming public keys would change the contract. */
const callUnsupportedModel = <T>(
  method: (modelId: never) => T,
  receiver: object
  // oxlint-disable-next-line typescript/no-unsafe-return -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
): T => Reflect.apply(method, receiver, ["unsupported-model"]);
/* oxlint-enable eslint/id-length */

/* oxlint-disable eslint/id-length -- Short callback indices and coordinate keys match the surrounding collection or external data shape; renaming public keys would change the contract. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
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
      // oxlint-disable-next-line typescript/unbound-method -- The fixture passes a receiver-independent mock or arrow callback so invocation identity remains observable.
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
      // oxlint-disable-next-line typescript/unbound-method -- The fixture passes a receiver-independent mock or arrow callback so invocation identity remains observable.
      return callUnsupportedModel(gateway.createImageModel, gateway);
    },
    createLanguageModel: (o) =>
      new OpenRouterGateway(o).createLanguageModel("openai/gpt-5-mini"),
    createVideoModel: (o) => {
      const gateway = new OpenRouterGateway(o);
      // oxlint-disable-next-line typescript/unbound-method -- The fixture passes a receiver-independent mock or arrow callback so invocation identity remains observable.
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
      // oxlint-disable-next-line typescript/unbound-method -- The fixture passes a receiver-independent mock or arrow callback so invocation identity remains observable.
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
      // oxlint-disable-next-line typescript/unbound-method -- The fixture passes a receiver-independent mock or arrow callback so invocation identity remains observable.
      return callUnsupportedModel(gateway.createVideoModel, gateway);
    },
    env: { LITELLM_BASE_URL: "https://example.test" },
    image: true,
    name: "litellm",
    video: false,
  },
];
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/id-length */

/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
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
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable unicorn/no-null */
