import { afterEach, expect, test, vi } from "vitest";
import { verifyPrivateBucket } from "./verify-private-bucket";

const environment = {
  SUPABASE_URL: "https://storage.example",
  SUPABASE_SERVICE_ROLE_KEY: "test-service-key",
};
afterEach(() => vi.unstubAllGlobals());
test("accepts only the exact private bucket and does not follow credential redirects", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue(Response.json({ id: "private", public: false }));
  vi.stubGlobal("fetch", fetcher);
  await verifyPrivateBucket("private", environment);
  expect(fetcher).toHaveBeenCalledWith(
    new URL("https://storage.example/storage/v1/bucket/private"),
    expect.objectContaining({ redirect: "error" })
  );
});
test.each([
  { id: "private", public: true },
  { id: "other", public: false },
  { id: "private" },
  null,
])("rejects unverified bucket privacy: %j", async (body) => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(body)));
  await expect(verifyPrivateBucket("private", environment)).rejects.toThrow(
    "must exist and be private"
  );
});
test("rejects service failures and insecure destinations", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue(new Response(null, { status: 503 }));
  vi.stubGlobal("fetch", fetcher);
  await expect(verifyPrivateBucket("private", environment)).rejects.toThrow(
    "Deployment refused"
  );
  fetcher.mockClear();
  await expect(
    verifyPrivateBucket("private", {
      ...environment,
      SUPABASE_URL: "http://storage.example",
    })
  ).rejects.toThrow("HTTPS");
  expect(fetcher).not.toHaveBeenCalled();
});
