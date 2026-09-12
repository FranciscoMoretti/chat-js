import { afterEach, describe, expect, it, vi } from "vitest";

import { VercelGateway } from "../../registry/src/gateways/vercel/gateway";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("VercelGateway", () => {
  it("skips unsupported models before validating supported model metadata", async () => {
    vi.stubEnv("AI_GATEWAY_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          Response.json({
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
                type: "language",
              },
            ],
            object: "list",
          })
        )
      )
    );

    const models = await new VercelGateway().fetchModels();

    expect(models).toHaveLength(1);
    expect(models[0]).toMatchObject({
      id: "openai/gpt-test",
      pricing: {
        input_cache_read_tiers: [
          { cost: "0.000001", max: 64_000, min: 0 },
          { cost: "0.000002", min: 64_000 },
        ],
      },
      type: "language",
    });
  });
});
