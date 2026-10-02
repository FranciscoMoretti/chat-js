import { guardedFetch } from "guarded-fetch";

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
