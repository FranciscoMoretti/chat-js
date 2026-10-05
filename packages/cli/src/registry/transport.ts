/** A process-local network policy around shadcn's native fetch calls.
 * shadcn still owns requests, authentication, redirects, caching and resolution.
 * Serialize operations so this temporary host policy cannot leak between calls.
 */
// Read SDK fields without changing native method signatures or return values.
type ReadonlyNative<Value> = Value extends (
  ...args: readonly never[]
) => unknown
  ? Value
  : Value extends object
    ? { readonly [Key in keyof Value]: ReadonlyNative<Value[Key]> }
    : Value;

let pending: Promise<void> = Promise.resolve();
const REDIRECT_STATUS_START = 300;
const REDIRECT_STATUS_END = 400;
const requireSecure = (url: string, redirect = false): void => {
  const parsed = new URL(url);
  if (parsed.protocol === "https:") {
    return;
  }
  if (
    !redirect &&
    parsed.protocol === "http:" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname)
  ) {
    return;
  }
  throw new Error(
    "Registry requests must use HTTPS (HTTP is allowed only on loopback, without redirects)."
  );
};
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve withRegistryTransport's awaited sequencing and rejected-Promise behavior. */
export const withRegistryTransport = async <Result>(
  operation: () => Promise<Result>
): Promise<Result> => {
  const run = async (): Promise<Result> => {
    const original = globalThis.fetch;
    globalThis.fetch = new Proxy<typeof fetch>(original, {
      // oxlint-disable-next-line typescript/promise-function-async -- Reject an insecure URL synchronously before invoking native fetch; making this Proxy trap async would move that check into a rejected promise.
      apply(
        _target: unknown,
        receiver: unknown,
        // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- ProxyHandler.apply accepts a mutable native argument array; readonly tuples fail its SDK signature (any[] may have fewer elements), so retain the exact fetch tuple and forward it unchanged.
        args: Parameters<typeof fetch>
      ): ReturnType<typeof fetch> {
        const [input] = args;
        const url = input instanceof Request ? input.url : String(input);
        requireSecure(url);
        return Reflect.apply(original, receiver, args).then(
          (response: ReadonlyNative<Response>): Response => {
            const location = response.headers.get("location");
            if (
              response.status >= REDIRECT_STATUS_START &&
              response.status < REDIRECT_STATUS_END &&
              typeof location === "string" &&
              location !== ""
            ) {
              requireSecure(new URL(location, url).href, true);
            }
            return response;
          }
        );
      },
    });
    try {
      return await operation();
    } finally {
      globalThis.fetch = original;
    }
  };
  const result = (async (): Promise<Result> => {
    await pending;
    return await run();
  })();
  pending = (async (): Promise<void> => {
    try {
      await result;
    } catch {
      // A rejected operation must release the serialization queue.
    }
  })();
  return await result;
};
/* oxlint-enable oxc/no-async-await */
