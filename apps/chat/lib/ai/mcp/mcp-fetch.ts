import { guardedFetch } from "guarded-fetch";

/* oxlint-disable jsdoc/require-returns -- The comment documents lifecycle behavior; the TypeScript return contract remains the authoritative result description. */
/* oxlint-disable jsdoc/require-param -- This comment documents the API invariant; parameter names and TypeScript annotations describe the inputs without duplicating them in tags. */
/* oxlint-disable eslint/no-undefined -- Undefined represents an omitted optional argument or absent value in the existing TypeScript/SDK contract. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
/** Covers transport, discovery and OAuth requests with the same network policy. */
export const mcpFetch = async (
  input: string | URL | Request,
  init?: RequestInit
): Promise<Response> => {
  const request = new Request(input, init);
  return await guardedFetch(request.url, {
    body: request.body ? await request.arrayBuffer() : undefined,
    headers: request.headers,
    method: request.method,
    opaqueErrors: true,
    signal: request.signal,
    timeoutMs: 30_000,
  });
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-undefined */
/* oxlint-enable jsdoc/require-param */
/* oxlint-enable jsdoc/require-returns */
