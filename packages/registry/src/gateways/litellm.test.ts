import { describe, expect, it, mock } from "bun:test";

import { LiteLLMGateway } from "./litellm/gateway";

const mockModelsFetch = () =>
  mock<typeof fetch>().mockResolvedValue(
    Response.json({
      data: [
        {
          created: 1_717_986_432,
          id: "openai/gpt-4o-mini",
          object: "model",
          owned_by: "openai",
        },
      ],
    })
  );

const fetchesModelsFromModelsEndpoint = async (): Promise<void> => {
  const fetchMock = mockModelsFetch();
  const models = await new LiteLLMGateway({
    env: {
      LITELLM_BASE_URL: "http://localhost:4000",
      LITELLM_API_KEY: "sk-test",
    },
    fetch: fetchMock,
  }).fetchModels();

  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [[url, init]] = fetchMock.mock.calls;
  expect(url).toBe("http://localhost:4000/v1/models");
  expect(init).toMatchObject({
    headers: {
      Authorization: "Bearer sk-test",
      "Content-Type": "application/json",
    },
  });
  expect(models).toEqual([
    {
      context_window: 0,
      created: 1_717_986_432,
      description: "",
      id: "openai/gpt-4o-mini",
      max_tokens: 0,
      name: "openai/gpt-4o-mini",
      object: "model",
      owned_by: "openai",
      pricing: {},
      type: "language",
    },
  ]);
};
const omitsAuthorizationForUnauthenticatedProxies = async (): Promise<void> => {
  const fetchMock = mockModelsFetch();
  await new LiteLLMGateway({
    env: { LITELLM_BASE_URL: "http://localhost:4000/" },
    fetch: fetchMock,
  }).fetchModels();

  const [[url, init]] = fetchMock.mock.calls;
  expect(url).toBe("http://localhost:4000/v1/models");
  expect(init).toMatchObject({
    headers: {
      "Content-Type": "application/json",
    },
  });
  if (!init) {
    throw new Error("Expected model request options");
  }
  expect(new Headers(init.headers).has("Authorization")).toBe(false);
};
const preservesConfiguredVersionPrefix = async (): Promise<void> => {
  const fetchMock = mockModelsFetch();
  await new LiteLLMGateway({
    env: { LITELLM_BASE_URL: "http://localhost:4000/v1" },
    fetch: fetchMock,
  }).fetchModels();

  const [[url]] = fetchMock.mock.calls;
  expect(url).toBe("http://localhost:4000/v1/models");
};
describe("LiteLLMGateway", (): void => {
  it(
    "fetches models from the LiteLLM /v1/models endpoint",
    fetchesModelsFromModelsEndpoint
  );

  it(
    "does not add authorization for unauthenticated proxies",
    omitsAuthorizationForUnauthenticatedProxies
  );

  it(
    "does not duplicate /v1 when the configured base URL includes it",
    preservesConfiguredVersionPrefix
  );
});
