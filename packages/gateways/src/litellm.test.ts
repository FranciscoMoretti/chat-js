import { afterEach, describe, expect, it, vi } from "vitest";

/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { LiteLLMGateway } from "../../registry/src/gateways/litellm/gateway";
/* oxlint-enable import/no-relative-parent-imports */

afterEach((): void => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
const mockModelsFetch = (): ReturnType<typeof vi.fn<typeof fetch>> => {
  const fetchMock = vi.fn<typeof fetch>((): Promise<Response> =>
    Promise.resolve(
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
    )
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
};
/* oxlint-enable typescript/promise-function-async */

const fetchesModelsFromModelsEndpoint = async (): Promise<void> => {
  vi.stubEnv("LITELLM_BASE_URL", "http://localhost:4000");
  vi.stubEnv("LITELLM_API_KEY", "sk-test");
  const fetchMock = mockModelsFetch();

  const models = await new LiteLLMGateway().fetchModels();

  expect(fetchMock).toHaveBeenCalledOnce();
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
  vi.stubEnv("LITELLM_BASE_URL", "http://localhost:4000/");
  vi.stubEnv("LITELLM_API_KEY", "");
  const fetchMock = mockModelsFetch();

  await new LiteLLMGateway().fetchModels();

  const [[url, init]] = fetchMock.mock.calls;
  expect(url).toBe("http://localhost:4000/v1/models");
  expect(init).toMatchObject({
    headers: {
      "Content-Type": "application/json",
    },
  });
  expect(new Headers(init?.headers).has("Authorization")).toBe(false);
};

const preservesConfiguredVersionPrefix = async (): Promise<void> => {
  vi.stubEnv("LITELLM_BASE_URL", "http://localhost:4000/v1");
  vi.stubEnv("LITELLM_API_KEY", "sk-test");
  const fetchMock = mockModelsFetch();

  await new LiteLLMGateway().fetchModels();

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
