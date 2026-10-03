import { expect, it, vi } from "vitest";

import { createCachedConnectionStatus } from "./cache";
import type { ConnectionStatusResult } from "./cache";

const mocks = vi.hoisted(() => ({ cache: vi.fn() }));
vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
  unstable_cache: mocks.cache,
}));

it.each(["disconnected", "authorizing", "connecting", "incompatible"])(
  "a transient %s result is retried while connected status uses the 60-second cache",
  async (transient) => {
    mocks.cache.mockImplementation(
      (fetcher: () => Promise<ConnectionStatusResult>) => {
        let stored: ConnectionStatusResult | undefined;
        return async () => {
          // oxlint-disable-next-line typescript/prefer-nullish-coalescing -- #602: Preserve the existing lazy initialization or absent-value guard; replacing it with coalescing changes the control-flow form.
          if (!stored) {
            stored = await fetcher();
          }
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
