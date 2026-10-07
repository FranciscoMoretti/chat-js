/* oxlint-disable unicorn/no-null -- Provider wire fixtures must exercise explicit JSON nulls as well as missing fields. */
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

test("provider models keep nullable defaults, unknown fields, and live IDs", async (): Promise<void> => {
  for (const Adapter of adapters) {
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
    // oxlint-disable-next-line no-await-in-loop -- Each adapter must independently convert the same wire fixture.
    const models = await gateway.fetchModels();
    expect(models).toMatchObject([
      { context_window: 0, created: 0, id: "new/provider-id", max_tokens: 0 },
    ]);
  }
});

test("malformed provider envelopes use the existing catalog fallback", async (): Promise<void> => {
  for (const Adapter of adapters) {
    for (const body of [
      { data: "invalid" },
      { data: [null] },
      { data: [{ id: false }] },
      { data: [{ created: "invalid", id: "model" }] },
    ]) {
      const gateway = new Adapter({
        env: {
          OPENAI_API_KEY: "test",
          OPENAI_COMPATIBLE_BASE_URL: "https://example.com",
          OPENROUTER_API_KEY: "test",
        },
        fetch: mock().mockResolvedValue(Response.json(body)),
        getFallbackModels: (): AiGatewayModel[] => [fallback],
      });
      // oxlint-disable-next-line no-await-in-loop -- Exercise each malformed envelope through every independent adapter boundary.
      expect(await gateway.fetchModels()).toEqual([fallback]);
    }
  }
});

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
