import { describe, expect, it, mock, spyOn } from "bun:test";
import * as oidc from "@vercel/oidc";

import { VercelGateway } from "./vercel/gateway";

const FIRST_MODEL_INDEX = 0;
const SUPPORTED_MODEL_COUNT = 2;
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
    {
      context_window: 0,
      created: 3,
      description: "Video model",
      id: "xai/grok-imagine-video",
      max_tokens: 0,
      name: "Video Test",
      object: "model",
      owned_by: "xai",
      pricing: {},
      type: "video",
    },
  ],
  object: "list",
};

describe("VercelGateway", () => {
  it("discovers the public catalog without a credential", async () => {
    const getToken = spyOn(oidc, "getVercelOidcToken").mockRejectedValue(
      new Error("No OIDC token")
    );
    const fetch = mock<typeof globalThis.fetch>().mockResolvedValue(
      Response.json(modelCatalogResponse)
    );
    try {
      const models = await new VercelGateway({ env: {}, fetch }).fetchModels();
      const [request] = fetch.mock.calls;
      const [url, init] = request ?? [];
      expect(url).toBe("https://ai-gateway.vercel.sh/v1/models");
      expect(init?.headers).toBeUndefined();
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      expect(models.map((model) => model.id)).toEqual([
        "openai/gpt-test",
        "xai/grok-imagine-video",
      ]);
    } finally {
      getToken.mockRestore();
    }
  });

  it("uses deployment OIDC to exclude models blocked by gateway policy", async () => {
    const model = modelCatalogResponse.data.find(
      ({ type }) => type === "language"
    );
    if (!model) {
      throw new Error("Missing language model fixture");
    }
    const fetch = mock<typeof globalThis.fetch>().mockResolvedValue(
      Response.json({
        ...modelCatalogResponse,
        data: [
          model,
          {
            ...model,
            id: "openai/blocked",
            model_eligibility: { status: "ineligible", category: "policy" },
          },
          {
            ...model,
            id: "openai/unknown",
            model_eligibility: { status: "unknown" },
          },
        ],
      })
    );
    const models = await new VercelGateway({
      env: { VERCEL_OIDC_TOKEN: "test-oidc" },
      fetch,
    }).fetchModels();
    const [request] = fetch.mock.calls;
    const [url, init] = request ?? [];
    expect(url).toBe(
      "https://ai-gateway.vercel.sh/v1/models?include_availability"
    );
    expect(init?.headers).toEqual({ Authorization: "Bearer test-oidc" });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(models.map((entry) => entry.id)).toEqual([
      "openai/gpt-test",
      "openai/unknown",
    ]);
  });

  it("skips unsupported models before validating supported model metadata", async () => {
    const models = await new VercelGateway({
      env: { AI_GATEWAY_API_KEY: "test-key" },
      fetch: mock<typeof fetch>().mockResolvedValue(
        Response.json(modelCatalogResponse)
      ),
    }).fetchModels();

    expect(models).toHaveLength(SUPPORTED_MODEL_COUNT);
    expect(models.map((model) => model.type)).toEqual(["language", "video"]);
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
