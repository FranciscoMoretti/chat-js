import { guardedFetch } from "guarded-fetch";

type ReadonlyNativeSurface<Value> = Value extends (
  ...parameters: readonly never[]
) => unknown
  ? Value
  : Value extends object
    ? {
        readonly [Property in keyof Value]: ReadonlyNativeSurface<
          Value[Property]
        >;
      }
    : Value;
const MCP_NETWORK_TIMEOUT_MS = 30_000;

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (mcpFetch); the enabled import/no-default-export convention rejects the default-export alternative. */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve mcpFetch's awaited sequencing and rejected-Promise behavior. */
/** Covers transport, discovery and OAuth requests with the same network policy.
 * @param {string | ReadonlyNativeSurface<URL | Request>} input - Native URL or request to protect with the MCP network policy.
 * @param {Readonly<RequestInit> | undefined} init - Native request overrides applied by the Request constructor.
 * @returns {Promise<Response>} The response from the guarded transport.
 */
export const mcpFetch = async (
  input: string | ReadonlyNativeSurface<URL | Request>,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Native Request receives RequestInit unchanged; readonly nested header tuples are not assignable to its HeadersInit receiver, and eager normalization changes getter/iterator evaluation order.
  init?: Readonly<RequestInit>
): Promise<Response> => {
  const request = new Request(input, init);
  return await guardedFetch(request.url, {
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Conditional spread (request.body ? { body: await request.arrayBuffer() } : {}) preserves the selected branch's own keys/values and positional overrides, including absent keys when a branch contributes none; pinned eslint/prefer-object-spread rejects Object.assign.
    ...(request.body ? { body: await request.arrayBuffer() } : {}),
    headers: request.headers,
    method: request.method,
    opaqueErrors: true,
    signal: request.signal,
    timeoutMs: MCP_NETWORK_TIMEOUT_MS,
  });
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
