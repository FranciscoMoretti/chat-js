import { expect, it, vi } from "vitest";

import { createCachedConnectionStatus } from "./cache";
import type { ConnectionStatusResult } from "./cache";

const mocks = vi.hoisted(() => ({ cache: vi.fn() }));
vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
  unstable_cache: mocks.cache,
}));

it("a transient disconnected result is retried while successful status uses the 60-second cache", async () => {
  mocks.cache.mockImplementation(
    (fetcher: () => Promise<ConnectionStatusResult>) => {
      let stored: ConnectionStatusResult | undefined;
      return async () => {
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
      status: "disconnected",
    })
    .mockResolvedValueOnce({ needsAuth: false, status: "connected" });
  const status = createCachedConnectionStatus("connector", fetcher);
  expect(await status()).toMatchObject({ status: "disconnected" });
  expect(await status()).toMatchObject({ status: "connected" });
  expect(await status()).toMatchObject({ status: "connected" });
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(mocks.cache).toHaveBeenCalledWith(
    expect.any(Function),
    ["mcp-connection-status", "connector"],
    expect.objectContaining({ revalidate: 60 })
  );
});
