import { afterEach, describe, expect, it, vi } from "vitest";
import { LiteLLMGateway } from "../../registry/src/gateways/litellm/gateway";

const originalBaseURL = process.env.LITELLM_BASE_URL;
const originalApiKey = process.env.LITELLM_API_KEY;

afterEach(() => {
  process.env.LITELLM_BASE_URL = originalBaseURL;
  process.env.LITELLM_API_KEY = originalApiKey;
  vi.unstubAllGlobals();
});

function mockModelsFetch() {
  const fetchMock = vi.fn(() => {
    return Promise.resolve(
      Response.json({
        data: [
          {
            id: "openai/gpt-4o-mini",
            object: "model",
            created: 1_717_986_432,
            owned_by: "openai",
          },
        ],
      }),
    );
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function getFetchCall(fetchMock: ReturnType<typeof mockModelsFetch>) {
  return fetchMock.mock.calls[0] as unknown as [
    string,
    {
      headers: Record<string, string>;
      next?: { revalidate: number };
    },
  ];
}

describe("LiteLLMGateway", () => {
  it("fetches models from the LiteLLM /v1/models endpoint", async () => {
    process.env.LITELLM_BASE_URL = "http://localhost:4000";
    process.env.LITELLM_API_KEY = "sk-test";
    const fetchMock = mockModelsFetch();

    const models = await new LiteLLMGateway().fetchModels();

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = getFetchCall(fetchMock);
    expect(url).toBe("http://localhost:4000/v1/models");
    expect(init).toMatchObject({
      headers: {
        Authorization: "Bearer sk-test",
        "Content-Type": "application/json",
      },
    });
    expect(models).toEqual([
      {
        id: "openai/gpt-4o-mini",
        object: "model",
        created: 1_717_986_432,
        owned_by: "openai",
        name: "openai/gpt-4o-mini",
        description: "",
        context_window: 0,
        max_tokens: 0,
        type: "language",
        pricing: {},
      },
    ]);
  });

  it("does not add authorization for unauthenticated proxies", async () => {
    process.env.LITELLM_BASE_URL = "http://localhost:4000/";
    process.env.LITELLM_API_KEY = "";
    const fetchMock = mockModelsFetch();

    await new LiteLLMGateway().fetchModels();

    const [url, init] = getFetchCall(fetchMock);
    expect(url).toBe("http://localhost:4000/v1/models");
    expect(init).toMatchObject({
      headers: {
        "Content-Type": "application/json",
      },
    });
    expect(init.headers.Authorization).toBeUndefined();
  });

  it("does not duplicate /v1 when the configured base URL includes it", async () => {
    process.env.LITELLM_BASE_URL = "http://localhost:4000/v1";
    process.env.LITELLM_API_KEY = "sk-test";
    const fetchMock = mockModelsFetch();

    await new LiteLLMGateway().fetchModels();

    const [url] = getFetchCall(fetchMock);
    expect(url).toBe("http://localhost:4000/v1/models");
  });
});
