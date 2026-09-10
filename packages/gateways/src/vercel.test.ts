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
            object: "list",
            data: [
              {
                id: "openai/tts-1",
                object: "model",
                created: 1,
                owned_by: "openai",
                name: "TTS 1",
                description: "Text to speech",
                type: "speech",
                pricing: {},
              },
              {
                id: "openai/gpt-test",
                object: "model",
                created: 2,
                owned_by: "openai",
                name: "GPT Test",
                description: "Language model",
                context_window: 128_000,
                max_tokens: 16_384,
                type: "language",
                pricing: {
                  input_cache_read_tiers: [
                    { cost: "0.000001", max: 64_000 },
                    { cost: "0.000002", min: 64_000 },
                  ],
                },
              },
            ],
          }),
        ),
      ),
    );

    const models = await new VercelGateway().fetchModels();

    expect(models).toHaveLength(1);
    expect(models[0]).toMatchObject({
      id: "openai/gpt-test",
      pricing: {
        input_cache_read_tiers: [
          { cost: "0.000001", min: 0, max: 64_000 },
          { cost: "0.000002", min: 64_000 },
        ],
      },
      type: "language",
    });
  });
});
