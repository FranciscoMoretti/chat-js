import { expect, it, vi } from "vitest";

import type { ConnectionStatusResult } from "./cache";
import { createCachedConnectionStatus } from "./cache";

const mocks = vi.hoisted(() => ({ cache: vi.fn() }));
vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
  unstable_cache: mocks.cache,
}));

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it.each(["disconnected", "authorizing", "connecting", "incompatible"])'s awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable init-declarations, no-magic-numbers --
 * init-declarations (#507): it.each(["disconnected", "authorizing", "connecting", "incompatible"])("a transient % assigns these bindings along its control-flow paths; eager undefined initialization would conflict with no-undefined and obscure definite assignment.
 * no-magic-numbers (#517): it.each(["disconnected", "authorizing", "connecting", "incompatible"])("a transient % uses 2 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
it.each(["disconnected", "authorizing", "connecting", "incompatible"])(
  "a transient %s result is retried while connected status uses the 60-second cache",
  async (transient) => {
    mocks.cache.mockImplementation(
      (fetcher: () => Promise<ConnectionStatusResult>) => {
        let stored: ConnectionStatusResult | undefined;
        return async (): Promise<ConnectionStatusResult> => {
          stored ??= await fetcher();
          return stored;
        };
      }
    );
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({
        error: "temporary",
        needsAuth: false,
        status: transient,
      })
      .mockResolvedValueOnce({ needsAuth: false, status: "connected" });
    const status = createCachedConnectionStatus("connector", fetcher);
    expect(await status()).toMatchObject({ status: transient });
    expect(await status()).toMatchObject({ status: "connected" });
    expect(await status()).toMatchObject({ status: "connected" });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(mocks.cache).toHaveBeenCalledWith(
      expect.any(Function),
      ["mcp-connection-status", "connector"],
      expect.objectContaining({
        revalidate: 60,
        tags: ["mcp-connection-status-connector"],
      })
    );
  }
);
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable init-declarations, no-magic-numbers */
