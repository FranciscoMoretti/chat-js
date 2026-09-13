/* oxlint-disable eslint/no-promise-executor-return -- These Promise executors directly register callback APIs whose return values are ignored. */
/* oxlint-disable promise/avoid-new -- These fixtures adapt callback, timer, stream, or browser event APIs into awaited Promises. */
/* oxlint-disable eslint/no-await-in-loop -- Integration steps and transaction fixtures intentionally run in order. */
/* oxlint-disable eslint/require-await -- Async mocks preserve the Promise-returning production callback contract. */
/* oxlint-disable eslint/sort-keys -- Fixture field order mirrors serialized protocol and persistence payloads. */
/* oxlint-disable unicorn/consistent-function-scoping -- One-off helpers stay beside the scenario state they coordinate. */
/* oxlint-disable unicorn/no-await-expression-member -- Direct awaited assertions keep each test action tied to its expectation. */
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
  .values({ email: `${owner}@test.invalid`, id: owner, name: "Eve test" });
afterAll(async () => {
  await db.delete(eveUsage).where(eq(eveUsage.ownerId, owner));
  await db.delete(eveConversation).where(eq(eveConversation.ownerId, owner));
  await db.delete(user).where(eq(user.id, owner));
});

test("billing replay is atomic, rounds per turn and preserves unknown costs", async () => {
  await db
    .insert(userCredit)
    .values({ credits: 50, userId: owner })
    .onConflictDoNothing();
  const sessionId = crypto.randomUUID();
  const eventId = crypto.randomUUID();
  const entry = {
    costUsd: 0.001,
    eventId,
    ownerId: owner,
    sessionId,
    turnId: "turn_0",
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
    costUsd: undefined,
    eventId: crypto.randomUUID(),
    turnId: "turn_1",
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
    costUsd: 0.0010000000000000002,
    eventId: crypto.randomUUID(),
    turnId: "precision",
  };
  await recordEveUsage(precise);
  await recordEveUsage(precise);
});
test("concurrent retry reserves once and cannot cross owners", async () => {
  const operation = crypto.randomUUID();
  let starts = 0;
  const start = async () => {
    starts += 1;
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
    createEveConversation(owner, operation, "hello", start, {
      initialModelId: "changed-model",
    })
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
      firstMessage: "process stopped",
      operationId: operation,
      ownerId: owner,
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
    isPinned: true,
    title: "renamed",
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
  const fork = { beforeTurnId: "turn_1", conversationId: root.id };
  const branch = await createEveConversation(
    owner,
    operation,
    "replacement",
    start,
    { fork }
  );
  expect(
    await createEveConversation(owner, operation, "replacement", start, {
      fork,
    })
  ).toEqual(branch);
  expect(starts).toBe(2);
  await expect(
    createEveConversation(owner, operation, "replacement", start, {
      fork: { ...fork, beforeTurnId: "turn_2" },
    })
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
    { fork: { beforeTurnId: "turn_2", conversationId: branch.id } }
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
    createEveConversation("not-owner", crypto.randomUUID(), "foreign", start, {
      fork,
    })
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
      firstMessage: "partial branch",
      operationId: crypto.randomUUID(),
      ownerId: owner,
      parentConversationId: root.id,
    })
  ).rejects.toThrow();
  const foreignOwner = crypto.randomUUID();
  await db.insert(user).values({
    email: `${foreignOwner}@test.invalid`,
    id: foreignOwner,
    name: "Ancestry constraint fixture",
  });
  try {
    await expect(
      db.insert(eveConversation).values({
        firstMessage: "foreign branch",
        forkTurnId: "turn_0",
        operationId: crypto.randomUUID(),
        ownerId: foreignOwner,
        parentConversationId: root.id,
        rootConversationId: root.id,
      })
    ).rejects.toThrow();
  } finally {
    await db
      .delete(eveConversation)
      .where(eq(eveConversation.ownerId, foreignOwner));
    await db.delete(user).where(eq(user.id, foreignOwner));
  }
});

test.each(["codeExecution", "webSearch"])(
  "%s receipts debit once per native call and keep missing cost evidence unresolved",
  async (toolName) => {
    const sessionId = crypto.randomUUID();
    const callId = crypto.randomUUID();
    const event: MessageStreamEvent = {
      data: {
        result: {
          callId,
          kind: "tool-result",
          output: createEvePlatformResult({ message: "42", chart: "" }, 0.05),
          toolName,
        },
        sequence: 0,
        status: "completed",
        stepIndex: 0,
        turnId: "tool-receipt",
      },
      meta: { at: new Date().toISOString(), id: crypto.randomUUID() },
      type: "action.result",
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
  }
);

test.each(["deleting", "deleted"] as const)(
  "%s conversations are fenced from access, mutation and creation replay",
  async (state) => {
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
      Boolean(
        await getDeletingEveConversationForSession(owner, bound.sessionId)
      )
    ).toBe(state === "deleting");
    expect(
      await getDeletingEveConversationForSession("other", bound.sessionId)
    ).toBeUndefined();

    const recoveryRow = (await listEveConversations(owner)).items.find(
      (row) => row.id === bound.id
    );
    // Pending deletion remains discoverable so its owner can resume cleanup.
    // The transcript and native access above remain fenced throughout.
    if (state === "deleting") {
      expect(recoveryRow).toMatchObject({ id: bound.id, state: "deleting" });
      expect(recoveryRow).not.toHaveProperty("sessionId");
    } else {
      expect(recoveryRow).toBeUndefined();
    }
    expect(await listEveConversationBranches(owner, bound.id)).toBeUndefined();
    expect(
      await updateEveConversationMetadata(owner, bound.id, {
        title: "resurrected",
        visibility: "public",
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
      createEveConversation(owner, crypto.randomUUID(), "fork", start, {
        fork: { beforeTurnId: "turn_0", conversationId: bound.id },
      })
    ).rejects.toThrow("not available");
    expect(starts).toBe(1);
    expect(
      (await listEveOwnerBindings(owner)).some(
        (row) => row.sessionId === bound.sessionId
      )
    ).toBe(state === "deleting");
  }
);

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
    { fork: { beforeTurnId: "turn_0", conversationId: root.id } }
  );
  await updateEveConversationMetadata(owner, root.id, { visibility: "public" });
  expect(await beginEveConversationDeletion("other", root.id)).toBeUndefined();
  expect(await getPublicEveConversation(root.id)).toBeDefined();
  const deletion = await beginEveConversationDeletion(owner, child.id);
  expect(deletion?.rootId).toBe(root.id);
  expect(deletion?.conversations.map((row) => row.id)).toEqual(
    [root.id, child.id].toSorted()
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
  const locked = Promise.withResolvers<undefined>();
  const release = Promise.withResolvers<undefined>();
  const documentWrite = db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`eve-document:${root.id}`}, 0))`
    );
    locked.resolve(undefined);
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
      { fork: { beforeTurnId: "turn_0", conversationId: root.id } }
    );
    const rejected = expect(fork).rejects.toThrow("not available");
    release.resolve(undefined);
    await documentWrite;
    await deletion;
    await rejected;
    expect(start).not.toHaveBeenCalled();
  } finally {
    release.resolve(undefined);
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
      { fork: { beforeTurnId: "turn_0", conversationId: root.id } }
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
    { initialContentHash: "hash", initialModelId: "model" }
  );
  const child = await createEveConversation(
    owner,
    crypto.randomUUID(),
    "Child text",
    start,
    { fork: { beforeTurnId: "turn_0", conversationId: root.id } }
  );
  const unrelated = await createEveConversation(
    owner,
    crypto.randomUUID(),
    "Keep this",
    start
  );
  await updateEveConversationMetadata(owner, root.id, {
    isPinned: true,
    title: "Private title",
    visibility: "public",
  });
  await db.insert(eveUsage).values({
    chargedCents: 1,
    costUsd: "0.01",
    eventId: crypto.randomUUID(),
    ownerId: owner,
    sessionId: root.sessionId,
    turnId: "turn_0",
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
      firstMessage: "",
      initialContentHash: null,
      initialModelId: null,
      isPinned: false,
      state: "deleted",
      title: null,
      visibility: "private",
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
    createEveConversation(owner, operation, "Private initial text", start, {
      initialContentHash: "hash",
      initialModelId: "model",
    })
  ).rejects.toThrow("can no longer be created");
  expect(start).toHaveBeenCalledTimes(3);
});

const copyReservationStates: (typeof eveConversation.$inferSelect.state)[] = [
  "creating",
  "uncertain",
  "bound",
];
test.each(copyReservationStates)(
  "ordinary creation cannot consume a %s copy reservation",
  async (state) => {
    const operationId = crypto.randomUUID();
    const sessionId = state === "bound" ? crypto.randomUUID() : null;
    const [copy] = await db
      .insert(eveConversation)
      .values({
        creationKind: "copy",
        firstMessage: "Same visible title",
        operationId,
        ownerId: owner,
        sessionId,
        state,
      })
      .returning();
    const create = vi.fn(() => Promise.resolve(crypto.randomUUID()));
    await expect(
      createEveConversation(owner, operationId, "Same visible title", create)
    ).rejects.toThrow("different");
    expect(create).not.toHaveBeenCalled();
    expect(await getEveCreation(owner, operationId)).toMatchObject({
      creationKind: "copy",
      id: copy.id,
      sessionId,
      state,
    });
  }
);

test("copy reservations must be fresh roots and creation kinds are enforced by PostgreSQL", async () => {
  const sourceOperation = crypto.randomUUID();
  const source = await createEveConversation(
    owner,
    sourceOperation,
    "Source",
    () => Promise.resolve(crypto.randomUUID())
  );
  await expect(
    db.insert(eveConversation).values({
      creationKind: "copy",
      firstMessage: "Invalid copy fork",
      forkTurnId: "turn_0",
      operationId: crypto.randomUUID(),
      ownerId: owner,
      parentConversationId: source.id,
      rootConversationId: source.id,
    })
  ).rejects.toThrow();
  await expect(
    db.execute(sql`insert into "EveConversation" ("ownerId", "operationId", "firstMessage", "creationKind")
    values (${owner}, ${crypto.randomUUID()}, 'Invalid kind', 'unrecognized')`)
  ).rejects.toThrow();
  expect(await getEveCreation(owner, sourceOperation)).toMatchObject({
    creationKind: "message",
  });
});

test("auxiliary model calls settle once per actual attempt even without a valid annotation", async () => {
  const sessionId = crypto.randomUUID();
  const event: MessageStreamEvent = {
    data: {
      hookId: "followup-suggestions",
      modelCalls: [
        { modelId: "google/gemini-2.5-flash-lite", usage: { costUsd: 0.002 } },
        { modelId: "google/gemini-2.5-flash-lite", usage: { costUsd: 0.003 } },
      ],
      turnId: "turn_0",
    },
    meta: { at: new Date().toISOString(), id: crypto.randomUUID() },
    type: "hook.result",
  };
  await Promise.all(
    Array.from({ length: 4 }, () => ingestEveUsage(owner, sessionId, event))
  );
  const entries = await db
    .select()
    .from(eveUsage)
    .where(eq(eveUsage.sessionId, sessionId));
  expect(entries).toHaveLength(2);
  expect(entries.reduce((sum, entry) => sum + Number(entry.costUsd), 0)).toBe(
    0.005
  );
  expect(entries.reduce((sum, entry) => sum + entry.chargedCents, 0)).toBe(1);
});
