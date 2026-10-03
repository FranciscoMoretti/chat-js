import { afterEach, describe, expect, it, vi } from "vitest";

/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { LiteLLMGateway } from "../../registry/src/gateways/litellm/gateway";
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable node/no-process-env -- Read configuration at this server or installer boundary so callers retain the documented environment-variable behavior. */
const originalBaseURL = process.env.LITELLM_BASE_URL;
/* oxlint-enable node/no-process-env */
/* oxlint-disable node/no-process-env -- Read configuration at this server or installer boundary so callers retain the documented environment-variable behavior. */
const originalApiKey = process.env.LITELLM_API_KEY;
/* oxlint-enable node/no-process-env */

/* oxlint-disable node/no-process-env -- Read configuration at this server or installer boundary so callers retain the documented environment-variable behavior. */
afterEach((): void => {
  process.env.LITELLM_BASE_URL = originalBaseURL;
  process.env.LITELLM_API_KEY = originalApiKey;
  vi.unstubAllGlobals();
});
/* oxlint-enable node/no-process-env */

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

/* oxlint-disable eslint/no-magic-numbers -- These values are concrete test inputs and expected results; naming each literal would make the fixture harder to compare with its assertions. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
const getFetchCall = (
  fetchMock: ReturnType<typeof mockModelsFetch>
): Parameters<typeof fetch> => fetchMock.mock.calls[0];
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-magic-numbers */

/* oxlint-disable eslint/max-lines-per-function -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable node/no-process-env -- Read configuration at this server or installer boundary so callers retain the documented environment-variable behavior. */
describe("LiteLLMGateway", (): void => {
  it("fetches models from the LiteLLM /v1/models endpoint", async (): Promise<void> => {
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
  });

  it("does not add authorization for unauthenticated proxies", async (): Promise<void> => {
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
    expect(new Headers(init?.headers).has("Authorization")).toBe(false);
  });

  it("does not duplicate /v1 when the configured base URL includes it", async (): Promise<void> => {
    process.env.LITELLM_BASE_URL = "http://localhost:4000/v1";
    process.env.LITELLM_API_KEY = "sk-test";
    const fetchMock = mockModelsFetch();

    await new LiteLLMGateway().fetchModels();

    const [url] = getFetchCall(fetchMock);
    expect(url).toBe("http://localhost:4000/v1/models");
  });
});
/* oxlint-enable node/no-process-env */
/* oxlint-enable eslint/max-lines-per-function */
