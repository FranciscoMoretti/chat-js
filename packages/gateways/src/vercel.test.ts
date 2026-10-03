import { afterEach, describe, expect, it, vi } from "vitest";

/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { VercelGateway } from "../../registry/src/gateways/vercel/gateway";
/* oxlint-enable import/no-relative-parent-imports */

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

/* oxlint-disable eslint/max-lines-per-function -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable eslint/no-magic-numbers -- These values are concrete test inputs and expected results; naming each literal would make the fixture harder to compare with its assertions. */
/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
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
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/max-lines-per-function */
