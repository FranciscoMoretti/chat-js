import { NextRequest } from "next/server";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { beforeEach, expect, test, vi } from "vitest";
/* oxlint-enable sort-imports */

import { GET } from "./route";

const SERVICE_UNAVAILABLE = 503;

const mocks = vi.hoisted(() => {
  const env: {
    CRON_SECRET: string | undefined;
    WORKFLOW_POSTGRES_URL: string;
  } = {
    CRON_SECRET: "fixture-secret",
    WORKFLOW_POSTGRES_URL: "postgresql://localhost/eve-test",
  };
  return {
    cleanupEve: vi.fn(),
    cleanupGuests: vi.fn(),
    env,
  };
});
vi.mock("@/lib/env", () => ({
  env: mocks.env,
}));
vi.mock("@/lib/eve/cleanup-orphaned-files", () => ({
  cleanupEveOrphanedFiles: mocks.cleanupEve,
}));

vi.mock("@/lib/eve/cleanup-expired-guests", () => ({
  cleanupExpiredEveGuests: mocks.cleanupGuests,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.env.CRON_SECRET = "fixture-secret";
  mocks.cleanupEve.mockResolvedValue({ deletedCount: 0, skipped: false });
  mocks.cleanupGuests.mockResolvedValue({
    deletedCount: 0,
    pendingCount: 0,
    skipped: false,
  });
});

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test.each([undefined, "", "   "])'s awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable no-magic-numbers, no-undefined --
 * no-magic-numbers (#517): test.each([undefined, "", " "])("unconfigured cleanup rejects a matching interpolated uses 401 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * no-undefined (#519): test.each([undefined, "", " "])("unconfigured cleanup rejects a matching interpolated uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 */
test.each([undefined, "", "   "])(
  "unconfigured cleanup rejects a matching interpolated credential: %j",
  async (secret) => {
    mocks.env.CRON_SECRET = secret;
    const response = await GET(
      new NextRequest("http://localhost/api/cron/cleanup", {
        headers: { authorization: `Bearer ${secret}` },
      })
    );
    expect(response.status).toBe(401);

    expect(mocks.cleanupEve).not.toHaveBeenCalled();
    expect(mocks.cleanupGuests).not.toHaveBeenCalled();
  }
);
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers, no-undefined */

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): test("cleanup uses EVE ownership") uses 200, 0, 4, 60, 1000 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
test("cleanup uses EVE ownership", async () => {
  const response = await GET(
    new NextRequest("http://localhost/api/cron/cleanup", {
      headers: { authorization: "Bearer fixture-secret" },
    })
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    results: {
      orphanedAttachments: {
        deletedCount: 0,
        skipped: false,
      },
    },
  });

  expect(mocks.cleanupEve).toHaveBeenCalledOnce();
  // oxlint-disable-next-line typescript/no-unsafe-call, typescript/no-unsafe-member-access -- #596: This route fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration. #597: This route fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration.
  expect(mocks.cleanupEve.mock.calls[0]?.[0].getTime()).toBeLessThanOrEqual(
    Date.now() - 4 * 60 * 60 * 1000
  );
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers */

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): test("cleanup still requires cron authorization") uses 401 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
test("cleanup still requires cron authorization", async () => {
  const response = await GET(
    new NextRequest("http://localhost/api/cron/cleanup")
  );
  expect(response.status).toBe(401);
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers */

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): test("storage failure does not prevent expired guest cleanup and reports retry") uses 503 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
test("storage failure does not prevent expired guest cleanup and reports retry", async () => {
  mocks.cleanupEve.mockRejectedValueOnce(new Error("storage unavailable"));
  const response = await GET(
    new NextRequest("http://localhost/api/cron/cleanup", {
      headers: { authorization: "Bearer fixture-secret" },
    })
  );
  expect(response.status).toBe(503);
  expect(mocks.cleanupGuests).toHaveBeenCalledWith(process.cwd());
  expect(await response.json()).toMatchObject({
    results: { expiredGuests: { pendingCount: 0 } },
    success: false,
  });
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers */

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): test("pending guest deletion is retryable failure after attachment cleanup runs") uses 503 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
test("pending guest deletion is retryable failure after attachment cleanup runs", async () => {
  mocks.cleanupGuests.mockResolvedValueOnce({
    deletedCount: 1,
    pendingCount: 1,
    skipped: false,
  });
  const response = await GET(
    new NextRequest("http://localhost/api/cron/cleanup", {
      headers: { authorization: "Bearer fixture-secret" },
    })
  );
  expect(response.status).toBe(503);
  expect(mocks.cleanupEve).toHaveBeenCalledOnce();
  expect(await response.json()).toMatchObject({ success: false });
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers */

test("unsupported guest cleanup never reports cron success or an empty backlog", async () => {
  const unsupported = {
    deletedCount: 0,
    reason: "unsupported_runtime",
    skipped: true,
  };
  mocks.cleanupGuests.mockResolvedValueOnce(unsupported);
  const response = await GET(
    new NextRequest("http://localhost/api/cron/cleanup", {
      headers: { authorization: "Bearer fixture-secret" },
    })
  );
  expect(response.status).toBe(SERVICE_UNAVAILABLE);
  expect(mocks.cleanupEve).toHaveBeenCalledOnce();
  const result: unknown = await response.json();
  expect(result).toMatchObject({
    results: { expiredGuests: unsupported },
    success: false,
  });
  expect(result).not.toHaveProperty("results.expiredGuests.pendingCount");
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
test("a skipped cleanup cannot become successful through a zero pending count", async () => {
  mocks.cleanupGuests.mockResolvedValueOnce({
    deletedCount: 0,
    pendingCount: 0,
    skipped: true,
  });
  const response = await GET(
    new NextRequest("http://localhost/api/cron/cleanup", {
      headers: { authorization: "Bearer fixture-secret" },
    })
  );
  expect(response.status).toBe(SERVICE_UNAVAILABLE);
  expect(await response.json()).toMatchObject({ success: false });
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
test("guest inventory failure reports retry while attachment cleanup still runs", async () => {
  mocks.cleanupGuests.mockRejectedValueOnce(
    new Error("private database details")
  );
  const response = await GET(
    new NextRequest("http://localhost/api/cron/cleanup", {
      headers: { authorization: "Bearer fixture-secret" },
    })
  );
  expect(response.status).toBe(SERVICE_UNAVAILABLE);
  expect(mocks.cleanupEve).toHaveBeenCalledOnce();
  expect(await response.json()).toMatchObject({
    results: {
      expiredGuests: { error: "Guest cleanup failed; retry required." },
      orphanedAttachments: { deletedCount: 0, skipped: false },
    },
    success: false,
  });
});
/* oxlint-enable oxc/no-async-await */
