import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, expect, test, vi } from "vitest";
import {
  eveChat,
  eveConversation,
  eveGuest,
  guestRuntimeSession,
  user,
} from "./schema";

const postgres = new PGlite();
const database = drizzle(postgres);
vi.mock("./client", () => ({ db: database }));
vi.mock("@/lib/env", () => ({ env: {} }));
const {
  createGuestRuntimeSession,
  bindGuestRuntimeSession,
  readGuestRuntimePolicy,
  readGuestRuntimeSession,
  reserveGuestRuntimeMessage,
  claimExpiredGuestRuntimeSession,
  completeGuestRuntimeDeletion,
  countPendingGuestRuntimeDeletions,
} = await import("./guest-runtime");
beforeAll(async () => {
  const directory = new URL("migrations/", import.meta.url);
  const entries = await readdir(directory);
  const files = entries.filter((name) => name.endsWith(".sql")).toSorted();
  const migrations = await Promise.all(
    files.map(async (name) => await readFile(new URL(name, directory), "utf-8"))
  );
  await postgres.exec(migrations.join("\n"));
}, 30_000);
afterAll(async () => {
  await postgres.close();
});
const input = () => ({
  ownerId: randomUUID(),
  modelId: "openai/gpt-5-nano",
  ipHash: randomUUID().replaceAll("-", "").repeat(2),
  credentialExpiresAt: new Date(Date.now() + 3_600_000),
  messageLimit: 2,
  requestsPerMinute: 5,
  sessionsPerHour: 5,
});
const create = async (value = input()) => {
  const result = await createGuestRuntimeSession(value);
  if (result.status !== "ready") {
    throw new Error("Expected guest admission.");
  }
  const sessionId = randomUUID();
  expect(
    await bindGuestRuntimeSession(result.guest.id, value.ownerId, sessionId)
  ).toBe(true);
  return { ...result.guest, sessionId };
};
test("policy pins ownership and session without creating an account", async () => {
  const guest = await create();
  expect(await database.select().from(user)).toHaveLength(0);
  expect(guest.expiresAt.getTime() - guest.createdAt.getTime()).toBe(
    86_400_000
  );
  expect(
    await bindGuestRuntimeSession(guest.id, "other", guest.sessionId)
  ).toBe(false);
  expect(
    await bindGuestRuntimeSession(guest.id, guest.ownerId, "different")
  ).toBe(false);
  expect(await readGuestRuntimePolicy(guest.id, "other")).toBeNull();
});
test("concurrent admissions cannot exceed session budget", async () => {
  const guest = await create();
  const outcomes = await Promise.all(
    Array.from(
      { length: 8 },
      async () =>
        await reserveGuestRuntimeMessage({
          sessionId: guest.sessionId,
          ownerId: guest.ownerId,
          requestsPerMinute: 100,
          inputCharacters: 10,
          maxInputCharacters: 24_000,
        })
    )
  );
  expect(outcomes.filter((value) => value === "ready")).toHaveLength(2);
  expect(outcomes.filter((value) => value === "exhausted")).toHaveLength(6);
});
test("IP rate limits span sessions and hourly creation", async () => {
  const seed = input();
  const first = await create({ ...seed, sessionsPerHour: 2 });
  const second = await create({
    ...seed,
    ownerId: randomUUID(),
    sessionsPerHour: 2,
  });
  const limited = await createGuestRuntimeSession({
    ...seed,
    ownerId: randomUUID(),
    sessionsPerHour: 2,
  });
  expect(limited.status).toBe("rate-limited");
  expect(
    await reserveGuestRuntimeMessage({
      sessionId: first.sessionId,
      ownerId: first.ownerId,
      requestsPerMinute: 1,
      inputCharacters: 10,
      maxInputCharacters: 24_000,
    })
  ).toBe("ready");
  expect(
    await reserveGuestRuntimeMessage({
      sessionId: second.sessionId,
      ownerId: second.ownerId,
      requestsPerMinute: 1,
      inputCharacters: 10,
      maxInputCharacters: 24_000,
    })
  ).toBe("rate-limited");
  const secondPolicy = await readGuestRuntimeSession(second.sessionId);
  expect(secondPolicy?.messagesUsed).toBe(0);
});
test("credential expiry and wrong owner prevent admission", async () => {
  const guest = await create();
  expect(
    await reserveGuestRuntimeMessage({
      sessionId: guest.sessionId,
      ownerId: "other",
      requestsPerMinute: 5,
      inputCharacters: 10,
      maxInputCharacters: 24_000,
    })
  ).toBe("unavailable");
  await database
    .update(guestRuntimeSession)
    .set({ credentialExpiresAt: new Date(0) })
    .where(eq(guestRuntimeSession.id, guest.id));
  expect(
    await reserveGuestRuntimeMessage({
      sessionId: guest.sessionId,
      ownerId: guest.ownerId,
      requestsPerMinute: 5,
      inputCharacters: 10,
      maxInputCharacters: 24_000,
    })
  ).toBe("unavailable");
});
test("cleanup claims expired guests only and fences completion to exact binding", async () => {
  const expired = await create();
  const active = await create();
  expect(await completeGuestRuntimeDeletion(active.id, active.sessionId)).toBe(
    false
  );
  await database
    .update(guestRuntimeSession)
    .set({
      createdAt: sql`now() - interval '25 hours'`,
      expiresAt: sql`now() - interval '1 hour'`,
    })
    .where(eq(guestRuntimeSession.id, expired.id));
  expect(await countPendingGuestRuntimeDeletions()).toBe(1);
  const claimed = await claimExpiredGuestRuntimeSession();
  expect(claimed?.id).toBe(expired.id);
  expect(await claimExpiredGuestRuntimeSession()).toBeNull();
  expect(await countPendingGuestRuntimeDeletions()).toBe(1);
  expect(await completeGuestRuntimeDeletion(expired.id, active.sessionId)).toBe(
    false
  );
  expect(
    await completeGuestRuntimeDeletion(expired.id, expired.sessionId)
  ).toBe(true);
  const activePolicy = await readGuestRuntimeSession(active.sessionId);
  expect(activePolicy?.state).toBe("active");
  expect(await countPendingGuestRuntimeDeletions()).toBe(0);
});

test("cumulative input budget is atomic and denied inputs do not consume quota", async () => {
  const guest = await create();
  const request = {
    sessionId: guest.sessionId,
    ownerId: guest.ownerId,
    requestsPerMinute: 100,
    inputCharacters: 8,
    maxInputCharacters: 10,
  };
  const outcomes = await Promise.all([
    reserveGuestRuntimeMessage(request),
    reserveGuestRuntimeMessage(request),
  ]);
  expect(outcomes.toSorted()).toEqual(["exhausted", "ready"]);
  const policy = await readGuestRuntimeSession(guest.sessionId);
  expect(policy?.inputCharactersUsed).toBe(8);
  expect(policy?.messagesUsed).toBe(1);
});

test("legacy read-only inventory ignores accounts and fully deleted guest families", async () => {
  const { hasExpiredEveGuestFamilies } = await import("./eve-guest-cleanup");
  const ownerId = randomUUID();
  const chatId = randomUUID();
  const conversationId = randomUUID();
  await database.insert(user).values({
    id: ownerId,
    email: `${ownerId}@example.test`,
    name: "Inventory fixture",
  });
  await database
    .insert(eveChat)
    .values({ id: chatId, ownerId, title: "Fixture" });
  await database.insert(eveConversation).values({
    id: conversationId,
    chatId,
    ownerId,
    operationId: randomUUID(),
    firstMessage: "Fixture",
    state: "bound",
  });
  expect(await hasExpiredEveGuestFamilies()).toBe(false);
  await database.insert(eveGuest).values({
    ownerId,
    expiresAt: new Date(0),
    messageLimit: 1,
    remainingMessages: 0,
    tokenHash: "f".repeat(64),
  });
  expect(await hasExpiredEveGuestFamilies()).toBe(true);
  await database
    .update(eveConversation)
    .set({ state: "deleted" })
    .where(eq(eveConversation.id, conversationId));
  expect(await hasExpiredEveGuestFamilies()).toBe(false);
});
