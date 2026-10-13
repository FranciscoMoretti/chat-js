import { expect, mock, test } from "bun:test";

import type { AiGatewayModel } from "@chat-js/gateways/models";

import { OpenAICompatibleGateway } from "./openai-compatible/gateway";
import { OpenAIGateway } from "./openai/gateway";
import { OpenRouterGateway } from "./openrouter/gateway";

const fallback: AiGatewayModel = {
  context_window: 0,
  created: 0,
  description: "",
  id: "fallback",
  max_tokens: 0,
  name: "Fallback",
  object: "model",
  owned_by: "test",
  pricing: {},
  type: "language",
};
const adapters = [OpenAIGateway, OpenAICompatibleGateway, OpenRouterGateway];

test.each(adapters)(
  "%p models keep nullable defaults, unknown fields, and live IDs",
  async (Adapter): Promise<void> => {
    const gateway = new Adapter({
      env: {
        OPENAI_API_KEY: "test",
        OPENAI_COMPATIBLE_BASE_URL: "https://example.com",
        OPENROUTER_API_KEY: "test",
      },
      fetch: mock().mockResolvedValue(
        Response.json({
          data: [
            {
              architecture: null,
              context_length: null,
              created: null,
              extra: true,
              id: "new/provider-id",
              owned_by: null,
              pricing: null,
              top_provider: null,
            },
          ],
        })
      ),
    });
    const models = await gateway.fetchModels();
    expect(models).toMatchObject([
      { context_window: 0, created: 0, id: "new/provider-id", max_tokens: 0 },
    ]);
  }
);

const malformedEnvelopes = [
  {},
  { data: null },
  { data: "invalid" },
  { data: [null] },
  { data: [{ id: false }] },
  { data: [{ created: "invalid", id: "model" }] },
];

test.each(
  adapters.flatMap((Adapter) =>
    malformedEnvelopes.map((body) => ({ Adapter, body }))
  )
)(
  "malformed provider envelopes use the existing catalog fallback: %p",
  async ({ Adapter, body }): Promise<void> => {
    const gateway = new Adapter({
      env: {
        OPENAI_API_KEY: "test",
        OPENAI_COMPATIBLE_BASE_URL: "https://example.com",
        OPENROUTER_API_KEY: "test",
      },
      fetch: mock().mockResolvedValue(Response.json(body)),
      getFallbackModels: (): AiGatewayModel[] => [fallback],
    });
    expect(await gateway.fetchModels()).toEqual([fallback]);
  }
);

test("OpenRouter rejects malformed modality fields", async (): Promise<void> => {
  const gateway = new OpenRouterGateway({
    env: { OPENROUTER_API_KEY: "test" },
    fetch: mock().mockResolvedValue(
      Response.json({
        data: [{ architecture: { output_modalities: [false] }, id: "model" }],
      })
    ),
    getFallbackModels: (): AiGatewayModel[] => [fallback],
  });
  expect(await gateway.fetchModels()).toEqual([fallback]);
});

test.each(adapters)(
  "%p valid catalog entries survive malformed neighbors in original order",
  async (Adapter): Promise<void> => {
    const gateway = new Adapter({
      env: {
        OPENAI_API_KEY: "test",
        OPENAI_COMPATIBLE_BASE_URL: "https://example.com",
        OPENROUTER_API_KEY: "test",
      },
      fetch: mock().mockResolvedValue(
        Response.json({
          data: [
            { id: "first" },
            null,
            { id: false },
            { created: "invalid", id: "bad" },
            { id: "second" },
          ],
        })
      ),
      getFallbackModels: (): AiGatewayModel[] => [fallback],
    });
    const models = await gateway.fetchModels();
    expect(models.map((model: { readonly id: string }) => model.id)).toEqual([
      "first",
      "second",
    ]);
  }
);

test.each(adapters)(
  "%p explicit empty catalog stays empty instead of using fallback",
  async (Adapter): Promise<void> => {
    const gateway = new Adapter({
      env: {
        OPENAI_API_KEY: "test",
        OPENAI_COMPATIBLE_BASE_URL: "https://example.com",
        OPENROUTER_API_KEY: "test",
      },
      fetch: mock().mockResolvedValue(Response.json({ data: [] })),
      getFallbackModels: (): AiGatewayModel[] => [fallback],
    });
    expect(await gateway.fetchModels()).toEqual([]);
  }
);

const capabilityModelResponse = {
  data: [
    {
      architecture: {
        input_modalities: ["image", "file"],
        output_modalities: ["text", "image"],
      },
      id: "all-capabilities",
      supported_parameters: ["reasoning", "include_reasoning", "tools"],
    },
    {
      architecture: {
        input_modalities: ["text"],
        output_modalities: ["image"],
      },
      id: "image-only",
    },
    {
      id: "reasoning-alias",
      supported_parameters: ["include_reasoning"],
    },
    { id: "plain" },
  ],
};

const expectedCapabilityModels = [
  {
    hasTags: true,
    id: "all-capabilities",
    tags: ["vision", "file-input", "image-generation", "reasoning", "tool-use"],
    type: "language",
  },
  {
    hasTags: true,
    id: "image-only",
    tags: ["image-generation"],
    type: "image",
  },
  {
    hasTags: true,
    id: "reasoning-alias",
    tags: ["reasoning"],
    type: "language",
  },
  { hasTags: true, id: "plain", tags: [], type: "language" },
];

test("OpenRouter preserves capability tag order and explicit empty-tag fields", async (): Promise<void> => {
  const gateway = new OpenRouterGateway({
    env: { OPENROUTER_API_KEY: "test" },
    fetch: mock().mockResolvedValue(Response.json(capabilityModelResponse)),
  });
  const models = await gateway.fetchModels();
  expect(
    models.map(
      (model: {
        readonly id: string;
        readonly tags?: readonly string[];
        readonly type: string;
      }) => ({
        hasTags: Object.hasOwn(model, "tags"),
        id: model.id,
        tags: model.tags ?? [],
        type: model.type,
      })
    )
  ).toEqual(expectedCapabilityModels);
  const plainModel = models.find(
    (model: { readonly id: string }) => model.id === "plain"
  );
  if (!plainModel) {
    throw new Error("Missing plain model fixture");
  }
  expect(plainModel.tags).toBeUndefined();
});
