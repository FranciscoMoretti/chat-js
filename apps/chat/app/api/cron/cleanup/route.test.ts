/* oxlint-disable sort-imports --
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import { NextRequest } from "next/server";
import { beforeEach, expect, test, vi } from "vitest";

import { GET } from "./route";
/* oxlint-enable sort-imports */

const mocks = vi.hoisted(() => ({
  cleanupEve: vi.fn(),
  cleanupGuests: vi.fn(),
  env: {
    // oxlint-disable-next-line typescript/no-unnecessary-type-assertion -- #591: This controlled fixture models the mocked boundary explicitly; changing its widening or coercion requires preserving the exercised failure scenario.
    CRON_SECRET: "fixture-secret" as string | undefined,

    WORKFLOW_POSTGRES_URL: "postgresql://localhost/eve-test",
  },
}));
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

/* oxlint-disable no-magic-numbers, no-undefined, oxc/no-async-await --
 * no-magic-numbers (#517): test.each([undefined, "", " "])("unconfigured cleanup rejects a matching interpolated uses 401 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * no-undefined (#519): test.each([undefined, "", " "])("unconfigured cleanup rejects a matching interpolated uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * oxc/no-async-await (#540): test.each([undefined, "", " "])("unconfigured cleanup rejects a matching interpolated sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
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
/* oxlint-enable no-magic-numbers, no-undefined, oxc/no-async-await */

/* oxlint-disable no-magic-numbers, oxc/no-async-await, oxc/no-optional-chaining --
 * no-magic-numbers (#517): test("cleanup uses EVE ownership") uses 200, 0, 4, 60, 1000 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * oxc/no-async-await (#540): test("cleanup uses EVE ownership") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * oxc/no-optional-chaining (#542): test("cleanup uses EVE ownership") handles optional mocks.cleanupEve.mock.calls[0]?.[0].getTime() without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
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
/* oxlint-enable no-magic-numbers, oxc/no-async-await, oxc/no-optional-chaining */

/* oxlint-disable no-magic-numbers, oxc/no-async-await --
 * no-magic-numbers (#517): test("cleanup still requires cron authorization") uses 401 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * oxc/no-async-await (#540): test("cleanup still requires cron authorization") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 */
test("cleanup still requires cron authorization", async () => {
  const response = await GET(
    new NextRequest("http://localhost/api/cron/cleanup")
  );
  expect(response.status).toBe(401);
});
/* oxlint-enable no-magic-numbers, oxc/no-async-await */

/* oxlint-disable no-magic-numbers, oxc/no-async-await --
 * no-magic-numbers (#517): test("storage failure does not prevent expired guest cleanup and reports retry") uses 503 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * oxc/no-async-await (#540): test("storage failure does not prevent expired guest cleanup and reports retry") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
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
/* oxlint-enable no-magic-numbers, oxc/no-async-await */

/* oxlint-disable no-magic-numbers, oxc/no-async-await --
 * no-magic-numbers (#517): test("pending guest deletion is retryable failure after attachment cleanup runs") uses 503 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * oxc/no-async-await (#540): test("pending guest deletion is retryable failure after attachment cleanup runs") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
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
/* oxlint-enable no-magic-numbers, oxc/no-async-await */
