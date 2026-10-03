/** A process-local network policy around shadcn's native fetch calls.
 * shadcn still owns requests, authentication, redirects, caching and resolution.
 * Serialize operations so this temporary host policy cannot leak between calls.
 */
let pending: Promise<void> = Promise.resolve();
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
/* oxlint-disable eslint/id-length -- Short callback indices and coordinate keys match the surrounding collection or external data shape; renaming public keys would change the contract. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/* oxlint-disable eslint/no-undefined -- Undefined represents an omitted optional argument or absent value in the existing TypeScript/SDK contract. */
/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
export const withRegistryTransport = <T>(
  operation: () => Promise<T>
): Promise<T> => {
  const run = async (): Promise<T> => {
    const original = globalThis.fetch;
    globalThis.fetch = new Proxy(original, {
      apply(target, receiver, args: Parameters<typeof fetch>) {
        const [input] = args;
        const url = input instanceof Request ? input.url : String(input);
        requireSecure(url);
        return Reflect.apply(target, receiver, args).then(
          (response: Response) => {
            const location = response.headers.get("location");
            if (
              response.status >= 300 &&
              response.status < 400 &&
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
  const result = (async (): Promise<T> => {
    await pending;
    return await run();
  })();
  pending = (async (): Promise<void> => {
    try {
      await result;
    } catch {
      return undefined;
    }
  })();
  return result;
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable eslint/no-undefined */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable eslint/id-length */
