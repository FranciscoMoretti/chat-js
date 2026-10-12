import { readFile, readdir } from "node:fs/promises";

import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, expect, test, vi } from "vitest";

import { eveGuestRate } from "./schema";
import { createEveGuestCredential } from "../eve/guest-credential";

const postgres = new PGlite();
const database = drizzle(postgres);
vi.mock("./client", () => ({ db: database }));
vi.mock("@/lib/env", () => ({ env: {} }));

const { createEveGuest, releaseEveGuestMessage, reserveEveGuestMessage } =
  await import("./eve-guests");

beforeAll(async () => {
  const directory = new URL("migrations/", import.meta.url);
  const entries = await readdir(directory);
  const filenames = entries.filter((name) => name.endsWith(".sql")).toSorted();
  const migrations = await Promise.all(
    filenames.map(
      async (name) => await readFile(new URL(name, directory), "utf-8")
    )
  );
  await postgres.exec(migrations.join("\n"));
}, 30_000);

afterAll(async () => {
  await postgres.close();
});

const createReservation = async (
  requestsPerMinute: number,
  requestsPerMonth: number
) => {
  const guest = await createEveGuest({
    expiresAt: new Date(Date.now() + 60_000),
    messageLimit: 10,
    tokenHash: createEveGuestCredential().tokenHash,
  });
  return {
    ipHash: createEveGuestCredential().tokenHash,
    operationId: crypto.randomUUID(),
    ownerId: guest.ownerId,
    requestHash: createEveGuestCredential().tokenHash,
    requestsPerMinute,
    requestsPerMonth,
  };
};

test("reservation and refund update both rate windows exactly once", async () => {
  const input = await createReservation(10, 10);
  const reserved = await reserveEveGuestMessage(input);
  if (reserved.status !== "reserved") {
    throw new Error("Expected a fresh reservation.");
  }
  const rates = async () => {
    const rows = await database
      .select()
      .from(eveGuestRate)
      .where(eq(eveGuestRate.ipHash, input.ipHash));
    return rows.map((row) => row.requests);
  };
  expect(await rates()).toEqual([1, 1]);
  await expect(reserveEveGuestMessage(input)).resolves.toMatchObject({
    status: "replay",
  });
  expect(await rates()).toEqual([1, 1]);
  await expect(
    releaseEveGuestMessage(
      input.ownerId,
      input.operationId,
      reserved.reservationId
    )
  ).resolves.toBe(true);
  expect(await rates()).toEqual([0, 0]);
  await expect(
    releaseEveGuestMessage(
      input.ownerId,
      input.operationId,
      reserved.reservationId
    )
  ).resolves.toBe(false);
  expect(await rates()).toEqual([0, 0]);
});

test.each([
  [1, 10],
  [10, 1],
])(
  "either rate window independently limits admission (%i, %i)",
  async (minute, month) => {
    const input = await createReservation(minute, month);
    await expect(reserveEveGuestMessage(input)).resolves.toMatchObject({
      status: "reserved",
    });
    await expect(
      reserveEveGuestMessage({ ...input, operationId: crypto.randomUUID() })
    ).resolves.toEqual({ status: "rate-limited" });
    const buckets = await database
      .select()
      .from(eveGuestRate)
      .where(eq(eveGuestRate.ipHash, input.ipHash));
    expect(buckets.map((row) => row.requests)).toEqual([1, 1]);
  }
);
