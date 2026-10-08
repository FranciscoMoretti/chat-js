import { afterEach, describe, expect, it, vi } from "vitest";

/* oxlint-disable import/no-relative-parent-imports -- This monorepo contract test imports the unexported Registry adapter source directly; the test file is excluded from published gateway artifacts. */
import { LiteLLMGateway } from "../../registry/src/gateways/litellm/gateway";
/* oxlint-enable import/no-relative-parent-imports */

afterEach((): void => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const mockModelsFetch = (): ReturnType<typeof vi.fn<typeof fetch>> => {
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
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
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
};

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve fetchesModelsFromModelsEndpoint's awaited sequencing and rejected-Promise behavior. */
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve omitsAuthorizationForUnauthenticatedProxies's awaited sequencing and rejected-Promise behavior. */
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
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading headers from init; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
  expect(new Headers(init?.headers).has("Authorization")).toBe(false);
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve preservesConfiguredVersionPrefix's awaited sequencing and rejected-Promise behavior. */
const preservesConfiguredVersionPrefix = async (): Promise<void> => {
  vi.stubEnv("LITELLM_BASE_URL", "http://localhost:4000/v1");
  vi.stubEnv("LITELLM_API_KEY", "sk-test");
  const fetchMock = mockModelsFetch();

  await new LiteLLMGateway().fetchModels();

  const [[url]] = fetchMock.mock.calls;
  expect(url).toBe("http://localhost:4000/v1/models");
};
/* oxlint-enable oxc/no-async-await */
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
