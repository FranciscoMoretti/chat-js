import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { z } from "zod";
import type { UsageBilling } from "@/chatjs/core/billing/contracts";

const postgres = new PGlite();
const policy = vi.hoisted((): { current: UsageBilling | undefined } => ({
  current: undefined,
}));
vi.mock("./client", () => ({ db: drizzle(postgres) }));
vi.mock("../env", () => ({ env: {} }));
vi.mock("@/integrations/billing", async () => {
  const { composeBilling } = await import("@/chatjs/core/billing/compose");
  return {
    get billing() {
      return composeBilling(policy.current ? [policy.current] : []);
    },
  };
});
const { creditsBilling } = await import("@/chatjs/plugins/credits/billing");
const { recordEveUsage } = await import("./eve-billing");
const rows = async (query: string): Promise<unknown[]> => {
  const result = await postgres.query(query);
  return result.rows;
};
const input = {
  eventId: "receipt",
  ownerId: "owner",
  sessionId: "session",
  turnId: "turn",
  costUsd: 0.004,
};

beforeAll(async () => {
  const journal = z
    .object({ entries: z.array(z.object({ tag: z.string() })) })
    .parse(
      JSON.parse(
        await readFile(
          new URL("migrations/meta/_journal.json", import.meta.url),
          "utf-8"
        )
      )
    );
  /* oxlint-disable no-await-in-loop -- Schema migrations depend on earlier entries. */
  for (const { tag } of journal.entries) {
    await postgres.exec(
      await readFile(new URL(`migrations/${tag}.sql`, import.meta.url), "utf-8")
    );
  }
  /* oxlint-enable no-await-in-loop */
  await postgres.exec(
    `INSERT INTO "user" (id, name, email) VALUES ('owner', 'Owner', 'owner@example.test');`
  );
}, 30_000);
beforeEach(async () => {
  policy.current = creditsBilling;
  await postgres.exec('DELETE FROM "EveUsage"; DELETE FROM "UserCredit";');
});
afterAll(async () => {
  await postgres.close();
});

it("grants the existing starting balance, rounds once per turn and deduplicates replay", async () => {
  expect(await creditsBilling.canSpend("owner")).toBe(true);
  await recordEveUsage(input);
  await recordEveUsage({ ...input, eventId: "second" });
  await recordEveUsage(input);
  expect(await rows('SELECT credits FROM "UserCredit"')).toEqual([
    { credits: 49 },
  ]);
  expect(
    await rows('SELECT sum("chargedCents")::int AS cents FROM "EveUsage"')
  ).toEqual([{ cents: 1 }]);
  await postgres.exec('UPDATE "UserCredit" SET credits = 0');
  expect(await creditsBilling.canSpend("owner")).toBe(false);
});

it("rolls back the receipt, debit and settlement marker together, then retries once", async () => {
  policy.current = {
    canSpend: creditsBilling.canSpend,
    debit: async (tx, debit) => {
      await creditsBilling.debit(tx, debit);
      throw new Error("debit failed");
    },
  };
  await expect(recordEveUsage(input)).rejects.toThrow("debit failed");
  expect(await rows('SELECT * FROM "EveUsage"')).toEqual([]);
  expect(await rows('SELECT * FROM "UserCredit"')).toEqual([]);
  policy.current = creditsBilling;
  await recordEveUsage(input);
  await recordEveUsage(input);
  expect(await rows('SELECT credits FROM "UserCredit"')).toEqual([
    { credits: 49 },
  ]);
});

it("records and reconciles usage without any credit table when billing is absent", async () => {
  policy.current = undefined;
  await postgres.exec(
    'ALTER TABLE "UserCredit" RENAME TO "UninstalledCredits"'
  );
  try {
    await recordEveUsage({ ...input, costUsd: undefined });
    await recordEveUsage(input);
    await recordEveUsage(input);
    expect(
      await rows('SELECT "costUsd", "chargedCents" FROM "EveUsage"')
    ).toEqual([{ costUsd: "0.004000000000", chargedCents: 0 }]);
  } finally {
    await postgres.exec(
      'ALTER TABLE "UninstalledCredits" RENAME TO "UserCredit"'
    );
  }
});
