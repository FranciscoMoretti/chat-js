import { describe, expect, it, mock } from "bun:test";

import { VercelGateway } from "./vercel/gateway";

const FIRST_MODEL_INDEX = 0;
const SUPPORTED_LANGUAGE_MODEL_COUNT = 1;
const modelCatalogResponse = {
  data: [
    {
      created: 1,
      description: "Text to speech",
      id: "openai/tts-1",
      name: "TTS 1",
      object: "model",
      owned_by: "openai",
      pricing: {},
      type: "speech",
    },
    {
      context_window: 128_000,
      created: 2,
      description: "Language model",
      id: "openai/gpt-test",
      max_tokens: 16_384,
      name: "GPT Test",
      object: "model",
      owned_by: "openai",
      pricing: {
        input_cache_read_tiers: [
          { cost: "0.000001", max: 64_000 },
          { cost: "0.000002", min: 64_000 },
        ],
      },
      tags: ["tool-use", "future-provider-tag"],
      type: "language",
    },
  ],
  object: "list",
};

describe("VercelGateway", () => {
  it("skips unsupported models before validating supported model metadata", async () => {
    const models = await new VercelGateway({
      env: { AI_GATEWAY_API_KEY: "test-key" },
      fetch: mock<typeof fetch>().mockResolvedValue(
        Response.json(modelCatalogResponse)
      ),
    }).fetchModels();

    expect(models).toHaveLength(SUPPORTED_LANGUAGE_MODEL_COUNT);
    const model: unknown = models[FIRST_MODEL_INDEX];
    expect(model).toMatchObject({
      id: "openai/gpt-test",
      pricing: {
        input_cache_read_tiers: [
          { cost: "0.000001", max: 64_000, min: 0 },
          { cost: "0.000002", min: 64_000 },
        ],
      },
      tags: ["tool-use", "future-provider-tag"],
      type: "language",
    });
  });
});
