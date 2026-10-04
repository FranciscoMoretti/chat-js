import { afterEach, expect, test, vi } from "vitest";

import { runHostedCleanup } from "./hosted-cleanup";

afterEach(() => vi.unstubAllGlobals());

const ok = 200;
const unavailable = 503;

test.each([
  [ok, { success: false }],
  [unavailable, { success: true }],
  [ok, { results: {} }],
])(
  "rejects incomplete cleanup (%s)",
  async (
    status,
    body: Readonly<{
      success?: boolean;
      results?: Readonly<Record<string, never>>;
    }>
  ) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Response.json(body, { status }))
    );
    await expect(
      runHostedCleanup("https://chat.example", "secret")
    ).rejects.toThrow();
  }
);

test("sends credentials only to the configured HTTPS origin without redirects", async () => {
  const request = vi.fn(() => Response.json({ success: true }));
  vi.stubGlobal("fetch", request);
  await runHostedCleanup("https://chat.example", "secret");
  expect(request).toHaveBeenCalledWith(
    new URL("https://chat.example/api/cron/cleanup"),
    expect.objectContaining({
      headers: { authorization: "Bearer secret" },
      redirect: "error",
    })
  );
});

test.each([
  "http://chat.example",
  "https://user:pass@chat.example",
  "https://chat.example/path",
])("refuses an unsafe scheduler target %s", async (origin) => {
  const request = vi.fn();
  vi.stubGlobal("fetch", request);
  await expect(runHostedCleanup(origin, "secret")).rejects.toThrow();
  expect(request).not.toHaveBeenCalled();
});
