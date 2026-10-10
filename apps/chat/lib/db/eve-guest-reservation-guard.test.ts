import { beforeEach, expect, it, vi } from "vitest";

import { reserveEveGuestMessages } from "./eve-guests";

const HASH_LENGTH = 64;
const REQUEST_QUOTA = 1;

const mocks = vi.hoisted(() => ({ transaction: vi.fn() }));
vi.mock("./client", () => ({ db: { transaction: mocks.transaction } }));
vi.mock("@/lib/env", () => ({ env: {} }));

beforeEach(() => {
  vi.clearAllMocks();
});

/* oxlint-disable oxc/no-async-await -- Exercise the production rejection before any database transaction starts. */
it("rejects a typed empty batch before entering SQL", async (): Promise<void> => {
  await expect(reserveEveGuestMessages([])).rejects.toThrow(
    "Guest admission requires at least one operation."
  );
  expect(mocks.transaction).not.toHaveBeenCalled();
});

it("accepts a typed operation through the original transaction boundary", async (): Promise<void> => {
  const boundaryError = new Error("Transaction boundary reached");
  mocks.transaction.mockRejectedValueOnce(boundaryError);
  const hash = "a".repeat(HASH_LENGTH);
  await expect(
    reserveEveGuestMessages([
      {
        ipHash: hash,
        operationId: crypto.randomUUID(),
        ownerId: "guest-owner",
        requestHash: hash,
        requestsPerMinute: REQUEST_QUOTA,
        requestsPerMonth: REQUEST_QUOTA,
      },
    ])
  ).rejects.toBe(boundaryError);
  expect(mocks.transaction).toHaveBeenCalledOnce();
});

/* oxlint-disable unicorn/no-null -- Null exercises the original explicit runtime object/null guard. */
it.each([true, "operation", Symbol("operation"), null])(
  "rejects malformed first operations before validation or SQL: %s",
  async (first: unknown): Promise<void> => {
    // @ts-expect-error: Exercise malformed JavaScript input outside the typed public API.
    await expect(reserveEveGuestMessages([first])).rejects.toThrow(
      "Guest admission requires at least one operation."
    );
    expect(mocks.transaction).not.toHaveBeenCalled();
  }
);
/* oxlint-enable unicorn/no-null */
/* oxlint-enable oxc/no-async-await */
