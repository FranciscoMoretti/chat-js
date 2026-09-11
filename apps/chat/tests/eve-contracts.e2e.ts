import { eq, sql } from "drizzle-orm";
import type { MessageStreamEvent } from "eve/client";
import { afterAll, expect, test, vi } from "vitest";
import { db } from "../lib/db/client";
import { recordEveUsage } from "../lib/db/eve-billing";
import { completeEveConversationDeletion } from "../lib/db/eve-deletion";
import {
  beginEveConversationDeletion,
  createEveConversation,
  getDeletingEveConversationForSession,
  getEveConversation,
  getEveCreation,
  getPublicEveConversation,
  listEveConversationBranches,
  listEveConversations,
  listEveOwnerBindings,
  ownsEveSession,
  recordEveConversationActivity,
  updateEveConversationMetadata,
} from "../lib/db/eve-queries";
import { eveConversation, eveUsage, user, userCredit } from "../lib/db/schema";
import { env } from "../lib/env";
import { createEvePlatformResult } from "../lib/eve/platform-result";
import { ingestEveUsage } from "../lib/eve/usage";
import { assertEveTestDatabase } from "./eve-test-database";

assertEveTestDatabase(env.DATABASE_URL);
const owner = crypto.randomUUID();
await db
  .insert(user)
  .values({ id: owner, email: `${owner}@test.invalid`, name: "Eve test" });
afterAll(async () => {
  await db.delete(eveUsage).where(eq(eveUsage.ownerId, owner));
  await db.delete(eveConversation).where(eq(eveConversation.ownerId, owner));
  await db.delete(user).where(eq(user.id, owner));
});

test("billing replay is atomic, rounds per turn and preserves unknown costs", async () => {
  await db
    .insert(userCredit)
    .values({ userId: owner, credits: 50 })
    .onConflictDoNothing();
  const sessionId = crypto.randomUUID();
  const eventId = crypto.randomUUID();
  const entry = {
    sessionId,
    eventId,
    ownerId: owner,
    turnId: "turn_0",
    costUsd: 0.001,
  };
  await Promise.all(Array.from({ length: 8 }, () => recordEveUsage(entry)));
  await recordEveUsage({ ...entry, eventId: crypto.randomUUID() });
  let [balance] = await db
    .select()
    .from(userCredit)
    .where(eq(userCredit.userId, owner));
  expect(balance?.credits).toBe(49);
  const unknown = {
    ...entry,
    eventId: crypto.randomUUID(),
    turnId: "turn_1",
    costUsd: undefined,
  };
  expect(await recordEveUsage(unknown)).toBe(false);
  const [row] = await db
    .select()
    .from(eveUsage)
    .where(eq(eveUsage.eventId, unknown.eventId));
  expect(row?.costUsd).toBeNull();
  expect(await recordEveUsage({ ...unknown, costUsd: 0.015 })).toBe(true);
  await recordEveUsage({ ...unknown, costUsd: 0.015 });
  [balance] = await db
    .select()
    .from(userCredit)
    .where(eq(userCredit.userId, owner));
  expect(balance?.credits).toBe(47);
  expect(await recordEveUsage(unknown)).toBe(true);
  await expect(recordEveUsage({ ...entry, costUsd: 0.5 })).rejects.toThrow(
    "amount changed"
  );
  const precise = {
    ...entry,
    eventId: crypto.randomUUID(),
    turnId: "precision",
    costUsd: 0.001_000_000_000_000_000_2,
  };
  await recordEveUsage(precise);
  await recordEveUsage(precise);
});
test("concurrent retry reserves once and cannot cross owners", async () => {
  const operation = crypto.randomUUID();
  let starts = 0;
  const start = async () => {
    starts++;
    await new Promise((resolve) => setTimeout(resolve, 50));
    return `test-${crypto.randomUUID()}`;
  };
  const results = await Promise.allSettled(
    Array.from({ length: 8 }, () =>
      createEveConversation(owner, operation, "hello", start)
    )
  );
  expect(starts).toBe(1);
  expect(
    results.filter((result) => result.status === "fulfilled").length
  ).toBeGreaterThan(0);
  const bound = await createEveConversation(owner, operation, "hello", start);
  await expect(
    createEveConversation(owner, operation, "hello", start, "changed-model")
  ).rejects.toThrow("different");
  expect(starts).toBe(1);
  expect(await ownsEveSession(owner, bound.sessionId)).toBe(true);
  expect(await ownsEveSession("other", bound.sessionId)).toBe(false);
  await expect(
    createEveConversation(owner, operation, "changed", start)
  ).rejects.toThrow("different");
});
test("a lost create reply is recovered through the same native operation", async () => {
  const operation = crypto.randomUUID();
  const dispatched: string[] = [];
  const nativeSession = `test-${crypto.randomUUID()}`;
  const start = (id: string) => {
    dispatched.push(id);
    return dispatched.length === 1
      ? Promise.reject(new Error("lost reply"))
      : Promise.resolve(nativeSession);
  };
  await expect(
    createEveConversation(owner, operation, "uncertain", start)
  ).rejects.toThrow("lost reply");
  const recovered = await createEveConversation(
    owner,
    operation,
    "uncertain",
    start
  );
  expect(recovered.sessionId).toBe(nativeSession);
  expect(dispatched).toEqual([recovered.id, recovered.id]);
  expect(
    await createEveConversation(owner, operation, "uncertain", start)
  ).toEqual(recovered);
  expect(dispatched).toHaveLength(2);
});

test("a stopped creator's reservation can be resumed without changing its identity", async () => {
  const operation = crypto.randomUUID();
  const [reservation] = await db
    .insert(eveConversation)
    .values({
      ownerId: owner,
      operationId: operation,
      firstMessage: "process stopped",
    })
    .returning();
  const bound = await createEveConversation(
    owner,
    operation,
    "process stopped",
    (id) => Promise.resolve(`test-${id}`)
  );
  expect(bound).toEqual({
    id: reservation.id,
    sessionId: `test-${reservation.id}`,
  });
});

test("activity projection is owner-scoped, monotonic, and independent of metadata edits", async () => {
  const bound = await createEveConversation(
    owner,
    crypto.randomUUID(),
    "activity",
    async () => crypto.randomUUID()
  );
  const before = await getEveConversation(owner, bound.id);
  const activityAt = new Date(Date.now() + 60_000);
  await recordEveConversationActivity("other", bound.sessionId, activityAt);
  expect((await getEveConversation(owner, bound.id))?.updatedAt).toEqual(
    before?.updatedAt
  );
  await recordEveConversationActivity(owner, bound.sessionId, activityAt);
  await recordEveConversationActivity(
    owner,
    bound.sessionId,
    new Date(activityAt.getTime() - 30_000)
  );
  await updateEveConversationMetadata(owner, bound.id, {
    title: "renamed",
    isPinned: true,
  });
  expect((await getEveConversation(owner, bound.id))?.updatedAt).toEqual(
    activityAt
  );
  expect(
    await updateEveConversationMetadata("other", bound.id, {
      title: "intrusion",
    })
  ).toBeUndefined();
  expect((await getEveConversation(owner, bound.id))?.firstMessage).toBe(
    "activity"
  );
});

test("fork reservations retain ancestry and reject changed sources on retry", async () => {
  let starts = 0;
  const start = () => {
    starts += 1;
    return Promise.resolve(crypto.randomUUID());
  };
  const root = await createEveConversation(
    owner,
    crypto.randomUUID(),
    "branch root",
    start
  );
  const operation = crypto.randomUUID();
  const fork = { conversationId: root.id, beforeTurnId: "turn_1" };
  const branch = await createEveConversation(
    owner,
    operation,
    "replacement",
    start,
    undefined,
    undefined,
    fork
  );
  expect(
    await createEveConversation(
      owner,
      operation,
      "replacement",
      start,
      undefined,
      undefined,
      fork
    )
  ).toEqual(branch);
  expect(starts).toBe(2);
  await expect(
    createEveConversation(
      owner,
      operation,
      "replacement",
      start,
      undefined,
      undefined,
      { ...fork, beforeTurnId: "turn_2" }
    )
  ).rejects.toThrow("source turn");
  await expect(
    createEveConversation(owner, operation, "replacement", start)
  ).rejects.toThrow("source turn");
  expect(starts).toBe(2);

  const nested = await createEveConversation(
    owner,
    crypto.randomUUID(),
    "nested replacement",
    start,
    undefined,
    undefined,
    { conversationId: branch.id, beforeTurnId: "turn_2" }
  );
  const row = await getEveConversation(owner, nested.id);
  expect(row?.rootConversationId).toBe(root.id);
  expect(row?.parentConversationId).toBe(branch.id);
  expect(row?.forkTurnId).toBe("turn_2");
  expect(row?.visibility).toBe("private");
  const family = await listEveConversationBranches(owner, nested.id);
  expect(family?.rootId).toBe(root.id);
  expect(family?.branches.map((item) => item.id)).toEqual([
    root.id,
    branch.id,
    nested.id,
  ]);
  expect(
    await listEveConversationBranches("not-owner", nested.id)
  ).toBeUndefined();
  await expect(
    createEveConversation(
      "not-owner",
      crypto.randomUUID(),
      "foreign",
      start,
      undefined,
      undefined,
      fork
    )
  ).rejects.toThrow("source conversation");
  expect(starts).toBe(3);
});

test("database constraints reject partial and cross-owner branch ancestry", async () => {
  const root = await createEveConversation(
    owner,
    crypto.randomUUID(),
    "constraint root",
    () => Promise.resolve(crypto.randomUUID())
  );
  await expect(
    db.insert(eveConversation).values({
      ownerId: owner,
      operationId: crypto.randomUUID(),
      firstMessage: "partial branch",
      parentConversationId: root.id,
    })
  ).rejects.toThrow();
  const foreignOwner = crypto.randomUUID();
  await db.insert(user).values({
    id: foreignOwner,
    email: `${foreignOwner}@test.invalid`,
    name: "Ancestry constraint fixture",
  });
  try {
    await expect(
      db.insert(eveConversation).values({
        ownerId: foreignOwner,
        operationId: crypto.randomUUID(),
        firstMessage: "foreign branch",
        parentConversationId: root.id,
        rootConversationId: root.id,
        forkTurnId: "turn_0",
      })
    ).rejects.toThrow();
  } finally {
    await db
      .delete(eveConversation)
      .where(eq(eveConversation.ownerId, foreignOwner));
    await db.delete(user).where(eq(user.id, foreignOwner));
  }
});

test.each([
  "codeExecution",
  "webSearch",
])("%s receipts debit once per native call and keep missing cost evidence unresolved", async (toolName) => {
  const sessionId = crypto.randomUUID();
  const callId = crypto.randomUUID();
  const event: MessageStreamEvent = {
    type: "action.result",
    meta: { id: crypto.randomUUID(), at: new Date().toISOString() },
    data: {
      turnId: "tool-receipt",
      stepIndex: 0,
      sequence: 0,
      status: "completed",
      result: {
        kind: "tool-result",
        toolName,
        callId,
        output: createEvePlatformResult({ message: "42", chart: "" }, 0.05),
      },
    },
  };
  await Promise.all(
    Array.from({ length: 8 }, () =>
      ingestEveUsage(owner, sessionId, {
        ...event,
        meta: { ...event.meta, id: crypto.randomUUID() },
      })
    )
  );
  const [row] = await db
    .select()
    .from(eveUsage)
    .where(eq(eveUsage.eventId, `eve-tool:${sessionId}:${callId}`));
  expect(Number(row.costUsd)).toBe(0.05);
  expect(row.chargedCents).toBe(5);
  const unknown = {
    ...event,
    data: {
      ...event.data,
      result: {
        ...event.data.result,
        callId: crypto.randomUUID(),
        output: "result lost its receipt",
      },
    },
  };
  expect(await ingestEveUsage(owner, sessionId, unknown)).toBe(false);
  const [unpriced] = await db
    .select()
    .from(eveUsage)
    .where(
      eq(
        eveUsage.eventId,
        `eve-tool:${sessionId}:${unknown.data.result.callId}`
      )
    );
  expect(unpriced.costUsd).toBeNull();
  expect(unpriced.chargedCents).toBe(0);
});

test.each([
  "deleting",
  "deleted",
] as const)("%s conversations are fenced from access, mutation and creation replay", async (state) => {
  const operation = crypto.randomUUID();
  let starts = 0;
  const start = () => {
    starts += 1;
    return Promise.resolve(crypto.randomUUID());
  };
  const bound = await createEveConversation(
    owner,
    operation,
    "deleted marker",
    start
  );
  await db
    .update(eveConversation)
    .set({ state, visibility: "public" })
    .where(eq(eveConversation.id, bound.id));
  const before = await getEveCreation(owner, operation);
  expect(await getEveConversation(owner, bound.id)).toBeUndefined();
  expect(await getPublicEveConversation(bound.id)).toBeUndefined();
  expect(await ownsEveSession(owner, bound.sessionId)).toBe(false);
  expect(
    Boolean(await getDeletingEveConversationForSession(owner, bound.sessionId))
  ).toBe(state === "deleting");
  expect(
    await getDeletingEveConversationForSession("other", bound.sessionId)
  ).toBeUndefined();

  expect(
    (await listEveConversations(owner)).items.some((row) => row.id === bound.id)
  ).toBe(false);
  expect(await listEveConversationBranches(owner, bound.id)).toBeUndefined();
  expect(
    await updateEveConversationMetadata(owner, bound.id, {
      visibility: "public",
      title: "resurrected",
    })
  ).toBeUndefined();
  await recordEveConversationActivity(
    owner,
    bound.sessionId,
    new Date(Date.now() + 60_000)
  );
  expect((await getEveCreation(owner, operation))?.updatedAt).toEqual(
    before?.updatedAt
  );
  await expect(
    createEveConversation(owner, operation, "deleted marker", start)
  ).rejects.toThrow("can no longer be created");
  await expect(
    createEveConversation(
      owner,
      crypto.randomUUID(),
      "fork",
      start,
      undefined,
      undefined,
      { conversationId: bound.id, beforeTurnId: "turn_0" }
    )
  ).rejects.toThrow("not available");
  expect(starts).toBe(1);
  expect(
    (await listEveOwnerBindings(owner)).some(
      (row) => row.sessionId === bound.sessionId
    )
  ).toBe(state === "deleting");
});

test("deletion fences the entire owned family and is retryable", async () => {
  const start = () => Promise.resolve(crypto.randomUUID());
  const root = await createEveConversation(
    owner,
    crypto.randomUUID(),
    "delete family",
    start
  );
  const child = await createEveConversation(
    owner,
    crypto.randomUUID(),
    "child",
    start,
    undefined,
    undefined,
    { conversationId: root.id, beforeTurnId: "turn_0" }
  );
  await updateEveConversationMetadata(owner, root.id, { visibility: "public" });
  expect(await beginEveConversationDeletion("other", root.id)).toBeUndefined();
  expect(await getPublicEveConversation(root.id)).toBeDefined();
  const deletion = await beginEveConversationDeletion(owner, child.id);
  expect(deletion?.rootId).toBe(root.id);
  expect(deletion?.conversations.map((row) => row.id).sort()).toEqual(
    [root.id, child.id].sort()
  );
  expect(await getPublicEveConversation(root.id)).toBeUndefined();
  expect(await ownsEveSession(owner, child.sessionId)).toBe(false);
  expect(await beginEveConversationDeletion(owner, root.id)).toEqual(deletion);
});

test("deletion waits for document commits and fences a concurrent fork", async () => {
  const root = await createEveConversation(
    owner,
    crypto.randomUUID(),
    "concurrent deletion",
    () => Promise.resolve(crypto.randomUUID())
  );
  const locked = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const documentWrite = db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`eve-document:${root.id}`}, 0))`
    );
    locked.resolve();
    await release.promise;
  });
  await locked.promise;
  const deletion = beginEveConversationDeletion(owner, root.id);
  try {
    await vi.waitFor(async () => {
      const available = await db.transaction(async (tx) => {
        const [row] = await tx.execute<{ locked: boolean }>(
          sql`select pg_try_advisory_xact_lock(hashtextextended(${`eve-family:${owner}`}, 0)) as locked`
        );
        return row.locked;
      });
      expect(available).toBe(false);
    });
    expect(await getEveConversation(owner, root.id)).toBeDefined();
    const start = vi.fn(() => Promise.resolve(crypto.randomUUID()));
    const fork = createEveConversation(
      owner,
      crypto.randomUUID(),
      "late fork",
      start,
      undefined,
      undefined,
      { conversationId: root.id, beforeTurnId: "turn_0" }
    );
    const rejected = expect(fork).rejects.toThrow("not available");
    release.resolve();
    await documentWrite;
    await deletion;
    await rejected;
    expect(start).not.toHaveBeenCalled();
  } finally {
    release.resolve();
    await documentWrite;
    await deletion;
  }
});

test("unresolved creation prevents a partial family deletion", async () => {
  const root = await createEveConversation(
    owner,
    crypto.randomUUID(),
    "recover first",
    () => Promise.resolve(crypto.randomUUID())
  );
  await expect(
    createEveConversation(
      owner,
      crypto.randomUUID(),
      "uncertain child",
      () => Promise.reject(new Error("offline")),
      undefined,
      undefined,
      { conversationId: root.id, beforeTurnId: "turn_0" }
    )
  ).rejects.toThrow("offline");
  await expect(beginEveConversationDeletion(owner, root.id)).rejects.toThrow(
    "Finish recovering"
  );
  expect(await ownsEveSession(owner, root.sessionId)).toBe(true);
});

test("final application deletion erases family content, preserves accounting and rejects old creation replay", async () => {
  const operation = crypto.randomUUID();
  const start = vi.fn(async () => crypto.randomUUID());
  const root = await createEveConversation(
    owner,
    operation,
    "Private initial text",
    start,
    "model",
    "hash"
  );
  const child = await createEveConversation(
    owner,
    crypto.randomUUID(),
    "Child text",
    start,
    undefined,
    undefined,
    { conversationId: root.id, beforeTurnId: "turn_0" }
  );
  const unrelated = await createEveConversation(
    owner,
    crypto.randomUUID(),
    "Keep this",
    start
  );
  await updateEveConversationMetadata(owner, root.id, {
    title: "Private title",
    isPinned: true,
    visibility: "public",
  });
  await db.insert(eveUsage).values({
    eventId: crypto.randomUUID(),
    sessionId: root.sessionId,
    turnId: "turn_0",
    ownerId: owner,
    costUsd: "0.01",
    chargedCents: 1,
  });
  const accounting = await db
    .select()
    .from(eveUsage)
    .where(eq(eveUsage.sessionId, root.sessionId));
  await expect(completeEveConversationDeletion(owner, root.id)).rejects.toThrow(
    "pending deletion"
  );
  await beginEveConversationDeletion(owner, child.id);
  await expect(
    completeEveConversationDeletion("other", root.id)
  ).rejects.toThrow("pending deletion");
  await expect(
    completeEveConversationDeletion(owner, child.id)
  ).rejects.toThrow("pending deletion");
  await completeEveConversationDeletion(owner, root.id);
  await completeEveConversationDeletion(owner, root.id);
  for (const id of [root.id, child.id]) {
    const [row] = await db
      .select()
      .from(eveConversation)
      .where(eq(eveConversation.id, id));
    expect(row).toMatchObject({
      state: "deleted",
      firstMessage: "",
      title: null,
      initialModelId: null,
      initialContentHash: null,
      visibility: "private",
      isPinned: false,
    });
    expect(row.sessionId).toBe(
      id === root.id ? root.sessionId : child.sessionId
    );
    expect(await getEveConversation(owner, id)).toBeUndefined();
  }
  expect((await getEveCreation(owner, operation))?.operationId).toBe(operation);
  expect((await getEveConversation(owner, unrelated.id))?.firstMessage).toBe(
    "Keep this"
  );
  expect(
    await db
      .select()
      .from(eveUsage)
      .where(eq(eveUsage.sessionId, root.sessionId))
  ).toEqual(accounting);
  await expect(
    createEveConversation(
      owner,
      operation,
      "Private initial text",
      start,
      "model",
      "hash"
    )
  ).rejects.toThrow("can no longer be created");
  expect(start).toHaveBeenCalledTimes(3);
});
