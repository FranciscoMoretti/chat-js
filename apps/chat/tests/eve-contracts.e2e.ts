import { userCredit } from "@/chatjs/plugins/credits/credits-schema";
import {
  getPublicEveConversation,
  setSharing,
} from "@/chatjs/plugins/sharing/queries";
import { createEveTestSession } from "./eve-native-session.fixture";
import { cleanupWorkspaceIfUnused } from "../lib/eve/persistent-sandbox-store";
import { reconcileEveWorkspaceTurn } from "../lib/eve/reconcile-workspace-turn";
import { EveWorkspaceBusyError } from "../lib/db/eve-workspace-turns";
import { dispatchEveOnce } from "../lib/db/eve-dispatch";
import {
  eveDispatch,
  eveChat,
  eveConversation,
  eveUsage,
  user,
} from "../lib/db/schema";
import { setTimeout as delay } from "node:timers/promises";

import { eq, sql } from "drizzle-orm";
import type { MessageStreamEvent } from "eve/client";
import { afterAll, expect, test, vi } from "vitest";

import { db } from "../lib/db/client";
import { recordEveUsage } from "../lib/db/eve-billing";
import { eveModelLedger } from "../lib/db/eve-model-ledger";
import { completeEveConversationDeletion } from "../lib/db/eve-deletion";
import {
  beginEveConversationDeletion,
  createEveConversation,
  getDeletingEveConversationForSession,
  getEveConversation,
  getEveCreation,
  listEveConversationBranches,
  listEveConversations,
  listEveOwnerBindings,
  ownsEveSession,
  recordEveConversationActivity,
  updateEveConversationMetadata,
} from "../lib/db/eve-queries";
import { env } from "../lib/env";
import { createToolResult } from "../lib/eve/tool-result";
import { ingestEveUsage } from "../lib/eve/usage";
import { insertEveConversationFixtures } from "./eve-conversation-fixture";
import { assertEveTestDatabase } from "./eve-test-database";

assertEveTestDatabase(env.DATABASE_URL);
const owner = crypto.randomUUID();

await db
  .insert(user)
  .values({ email: `${owner}@test.invalid`, id: owner, name: "Eve test" });
afterAll(async () => {
  await db.delete(eveDispatch).where(eq(eveDispatch.ownerId, owner));
  await db.delete(eveUsage).where(eq(eveUsage.ownerId, owner));
  await db.delete(eveConversation).where(eq(eveConversation.ownerId, owner));
  await db.delete(user).where(eq(user.id, owner));
});

test("billing replay is atomic, rounds per turn and preserves unknown costs", async () => {
  await db
    .insert(userCredit)
    .values({ balanceCents: 50, userId: owner })
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
  await Promise.all(
    Array.from({ length: 8 }, async () => await recordEveUsage(entry))
  );
  await recordEveUsage({ ...entry, eventId: crypto.randomUUID() });
  let [balance] = await db
    .select()
    .from(userCredit)
    .where(eq(userCredit.userId, owner));
  expect(balance?.balanceCents).toBe(49);
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
  expect(balance?.balanceCents).toBe(47);
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
  const start = async (): Promise<string> => {
    starts += 1;
    await delay(50);
    return `test-${crypto.randomUUID()}`;
  };
  const results = await Promise.allSettled(
    Array.from(
      { length: 8 },
      async () => await createEveConversation(owner, operation, "hello", start)
    )
  );
  expect(starts).toBe(1);
  expect(
    results.filter(
      (result: Readonly<{ status: "fulfilled" | "rejected" }>) =>
        result.status === "fulfilled"
    ).length
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

test("a lost create reply stays unresolved and never redispatches", async () => {
  const operation = crypto.randomUUID();
  const start = vi
    .fn<() => Promise<string>>()
    .mockRejectedValue(new Error("lost reply"));
  await expect(
    createEveConversation(owner, operation, "uncertain", start)
  ).rejects.toThrow("lost reply");
  await expect(
    createEveConversation(owner, operation, "uncertain", start)
  ).rejects.toThrow("outcome is unknown");
  expect(start).toHaveBeenCalledTimes(1);
  const unresolved = await getEveCreation(owner, operation);
  expect(unresolved?.state).toBe("uncertain");
});

test("a stopped creator's reservation can be resumed without changing its identity", async () => {
  const operation = crypto.randomUUID();
  const [reservation] = await insertEveConversationFixtures({
    firstMessage: "process stopped",
    operationId: operation,
    ownerId: owner,
  });
  const bound = await createEveConversation(
    owner,
    operation,
    "process stopped",

    (id) => `test-${id}`
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
    createEveTestSession
  );
  const before = await getEveConversation(owner, bound.id);
  const activityAt = new Date(Date.now() + 60_000);
  await recordEveConversationActivity("other", bound.sessionId, activityAt);
  const conversationBeforeOwnerActivity = await getEveConversation(
    owner,
    bound.id
  );
  expect(conversationBeforeOwnerActivity?.updatedAt).toEqual(before?.updatedAt);
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
  const conversationAfterOwnerActivity = await getEveConversation(
    owner,
    bound.id
  );
  expect(conversationAfterOwnerActivity?.updatedAt).toEqual(activityAt);
  expect(
    await updateEveConversationMetadata("other", bound.id, {
      title: "intrusion",
    })
  ).toBeUndefined();
  const conversationAfterMetadataEdit = await getEveConversation(
    owner,
    bound.id
  );
  expect(conversationAfterMetadataEdit?.firstMessage).toBe("activity");
});

test("fork reservations retain ancestry and reject changed sources on retry", async () => {
  let starts = 0;
  const start = (): string => {
    starts += 1;
    return createEveTestSession();
  };
  const root = await createEveConversation(
    owner,
    crypto.randomUUID(),
    "branch root",
    start
  );
  const operation = crypto.randomUUID();
  const fork = { conversationId: root.id };
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
      fork: { conversationId: crypto.randomUUID() },
    })
  ).rejects.toThrow("source conversation");
  await expect(
    createEveConversation(owner, operation, "replacement", start)
  ).rejects.toThrow("source conversation");
  expect(starts).toBe(2);

  const nested = await createEveConversation(
    owner,
    crypto.randomUUID(),
    "nested replacement",
    start,
    { fork: { conversationId: branch.id } }
  );
  const row = await getEveConversation(owner, nested.id);
  expect(row?.rootConversationId).toBe(root.id);
  expect(row?.parentConversationId).toBe(branch.id);
  expect(row?.forkTurnId).toBeNull();
  expect(row?.visibility).toBe("private");
  const family = await listEveConversationBranches(owner, nested.id);
  expect(family?.rootId).toBe(root.id);
  expect(
    family?.branches.map((item: Readonly<{ id: string }>) => item.id)
  ).toEqual([root.id, branch.id, nested.id]);
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
    createEveTestSession
  );
  await expect(
    insertEveConversationFixtures({
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
      insertEveConversationFixtures({
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
    const result = createToolResult({ message: "42", chart: "" }, 0.05);
    expect(JSON.stringify(result)).not.toContain('"updates"');
    const event = {
      data: {
        result: {
          callId,
          kind: "tool-result",

          output: result,
          toolName,
        },
        status: "completed",
        turnId: "tool-receipt",
      },
      meta: { at: new Date().toISOString(), id: crypto.randomUUID() },
      type: "action.result",
    } satisfies Parameters<typeof ingestEveUsage>[2] & {
      data: { result: { toolName: string } };
    };
    await Promise.all(
      Array.from(
        { length: 8 },
        async () =>
          await ingestEveUsage(owner, sessionId, {
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
          output: { ...result, usage: {} },
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
    const start = (): string => {
      starts += 1;
      return crypto.randomUUID();
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
    const creation = await getEveCreation(owner, operation);
    const [before] = await db
      .select({ updatedAt: eveChat.updatedAt })
      .from(eveChat)
      .where(eq(eveChat.id, creation?.chatId ?? ""));
    expect(await getEveConversation(owner, bound.id)).toBeNull();
    expect(await getPublicEveConversation(bound.id)).toBeUndefined();
    expect(await ownsEveSession(owner, bound.sessionId)).toBe(false);
    expect(
      Boolean(
        await getDeletingEveConversationForSession(owner, bound.sessionId)
      )
    ).toBe(state === "deleting");
    expect(
      await getDeletingEveConversationForSession("other", bound.sessionId)
    ).toBeNull();

    const recoveryConversations = await listEveConversations(owner);
    const recoveryRow = recoveryConversations.items.find(
      (row: Readonly<{ conversationId: string }>) =>
        row.conversationId === bound.id
    );
    // Pending deletion remains discoverable so its owner can resume cleanup.
    // The transcript and native access above remain fenced throughout.
    if (state === "deleting") {
      expect(recoveryRow).toMatchObject({
        conversationId: bound.id,
        state: "deleting",
      });
      expect(recoveryRow).not.toHaveProperty("sessionId");
    } else {
      expect(recoveryRow).toBeUndefined();
    }
    expect(await listEveConversationBranches(owner, bound.id)).toBeUndefined();
    expect(
      await updateEveConversationMetadata(owner, bound.id, {
        title: "resurrected",
      })
    ).toBeUndefined();
    await recordEveConversationActivity(
      owner,
      bound.sessionId,
      new Date(Date.now() + 60_000)
    );
    const [afterActivity] = await db
      .select({ updatedAt: eveChat.updatedAt })
      .from(eveChat)
      .where(eq(eveChat.id, creation?.chatId ?? ""));
    expect(afterActivity?.updatedAt).toEqual(before?.updatedAt);
    await expect(
      createEveConversation(owner, operation, "deleted marker", start)
    ).rejects.toThrow("can no longer be created");
    await expect(
      createEveConversation(owner, crypto.randomUUID(), "fork", start, {
        fork: { conversationId: bound.id },
      })
    ).rejects.toThrow("not available");
    expect(starts).toBe(1);
    const ownerBindingsAfterDeletion = await listEveOwnerBindings(owner);
    expect(
      ownerBindingsAfterDeletion.some(
        (row) => row.sessionId === bound.sessionId
      )
    ).toBe(state === "deleting");
  }
);

test("deletion fences the entire owned family and is retryable", async () => {
  const root = await createEveConversation(
    owner,
    crypto.randomUUID(),
    "delete family",
    createEveTestSession
  );
  const child = await createEveConversation(
    owner,
    crypto.randomUUID(),
    "child",
    createEveTestSession,
    { fork: { conversationId: root.id } }
  );
  await setSharing(owner, root.id, "public");
  expect(await beginEveConversationDeletion("other", root.id)).toBeNull();
  expect(await getPublicEveConversation(root.id)).toBeDefined();
  const rootCreation = await getEveConversation(owner, root.id);
  const deletion = await beginEveConversationDeletion(
    owner,
    rootCreation?.chatId ?? "missing"
  );
  expect(deletion?.rootId).toBe(rootCreation?.chatId);
  expect(deletion?.conversations.map((row) => row.id)).toEqual(
    [root.id, child.id].toSorted()
  );
  expect(await getPublicEveConversation(root.id)).toBeUndefined();
  expect(await ownsEveSession(owner, child.sessionId)).toBe(false);
  expect(
    await beginEveConversationDeletion(owner, rootCreation?.chatId ?? "missing")
  ).toEqual(deletion);
});

test("deletion waits for document commits and fences a concurrent fork", async () => {
  const root = await createEveConversation(
    owner,
    crypto.randomUUID(),
    "concurrent deletion",
    createEveTestSession
  );
  const locked: PromiseWithResolvers<void> = Promise.withResolvers();
  const release: PromiseWithResolvers<void> = Promise.withResolvers();
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
    const start = vi.fn(createEveTestSession);
    const fork = createEveConversation(
      owner,
      crypto.randomUUID(),
      "late fork",
      start,
      { fork: { conversationId: root.id } }
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
    createEveTestSession
  );
  await expect(
    createEveConversation(
      owner,
      crypto.randomUUID(),
      "uncertain child",
      vi.fn<() => Promise<string>>().mockRejectedValue(new Error("offline")),
      { fork: { conversationId: root.id } }
    )
  ).rejects.toThrow("offline");
  const rootCreation = await getEveConversation(owner, root.id);
  await expect(
    beginEveConversationDeletion(owner, rootCreation?.chatId ?? "missing")
  ).rejects.toThrow("Finish recovering");
  expect(await ownsEveSession(owner, root.sessionId)).toBe(true);
});

test("final application deletion erases family content, preserves accounting and rejects old creation replay", async () => {
  const operation = crypto.randomUUID();
  const start = vi.fn(createEveTestSession);
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
    { fork: { conversationId: root.id } }
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
  });
  await setSharing(owner, root.id, "public");
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
  const family = await getEveConversation(owner, root.id);
  const chatId = family?.chatId ?? "missing";
  await reconcileEveWorkspaceTurn(owner, root.id);
  await beginEveConversationDeletion(owner, chatId);
  await expect(completeEveConversationDeletion(owner, chatId)).rejects.toThrow(
    "Workspace cleanup is incomplete"
  );
  await cleanupWorkspaceIfUnused(
    owner,
    family?.workspaceId ?? "missing",
    () => {
      throw new Error("Text-only fixture must not allocate a sandbox");
    }
  );
  await expect(
    completeEveConversationDeletion("other", root.id)
  ).rejects.toThrow("Conversation identity is unavailable");
  // Explicit chat deletion retires the family; conversation deletion is scoped.
  await completeEveConversationDeletion(owner, chatId);
  await completeEveConversationDeletion(owner, chatId);
  await Promise.all(
    [root.id, child.id].map(async (id) => {
      const [row] = await db
        .select()
        .from(eveConversation)
        .where(eq(eveConversation.id, id));
      expect(row).toMatchObject({
        firstMessage: "",
        initialContentHash: null,
        initialModelId: null,
        initialRequest: null,
        state: "deleted",
        visibility: "private",
      });
      expect(row.sessionId).toBe(
        id === root.id ? root.sessionId : child.sessionId
      );
      expect(await getEveConversation(owner, id)).toBeNull();
    })
  );
  const deletedCreation = await getEveCreation(owner, operation);
  if (deletedCreation === undefined) {
    throw new Error("Missing retained creation tombstone");
  }
  const [deletedChat] = await db
    .select()
    .from(eveChat)
    .where(eq(eveChat.id, deletedCreation.chatId));
  expect(deletedChat).toMatchObject({
    title: "",
    isPinned: false,
    activeConversationId: null,
  });
  const tombstonedCreationReplay = await getEveCreation(owner, operation);
  expect(tombstonedCreationReplay?.operationId).toBe(operation);
  const unrelatedConversation = await getEveConversation(owner, unrelated.id);
  expect(unrelatedConversation?.firstMessage).toBe("Keep this");
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
    const [copy] = await insertEveConversationFixtures({
      creationKind: "copy",
      firstMessage: "Same visible title",
      operationId,
      ownerId: owner,
      sessionId,
      state,
    });
    const create = vi.fn(createEveTestSession);
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

test("copy reservations retain shared ancestry and creation kinds are enforced by PostgreSQL", async () => {
  const sourceOperation = crypto.randomUUID();
  const source = await createEveConversation(
    owner,
    sourceOperation,
    "Source",
    createEveTestSession
  );
  const [copy] = await insertEveConversationFixtures({
    creationKind: "copy",
    firstMessage: "Shared-workspace copy",
    forkTurnId: "turn_0",
    operationId: crypto.randomUUID(),
    ownerId: owner,
    parentConversationId: source.id,
    rootConversationId: source.id,
  });
  const sourceRow = await getEveConversation(owner, source.id);
  expect(copy.parentConversationId).toBe(source.id);
  expect(copy.workspaceId).toBe(sourceRow?.workspaceId);
  await expect(
    db.execute(sql`insert into "EveConversation" ("ownerId", "operationId", "firstMessage", "creationKind")
    values (${owner}, ${crypto.randomUUID()}, 'Invalid kind', 'unrecognized')`)
  ).rejects.toThrow();
  expect(await getEveCreation(owner, sourceOperation)).toMatchObject({
    creationKind: "message",
  });
});

test("auxiliary model calls settle once per actual attempt independently of completion events", async () => {
  const conversation = await createEveConversation(
    owner,
    crypto.randomUUID(),
    "Followup billing",
    createEveTestSession
  );
  const { sessionId } = conversation;
  if (!sessionId) {
    throw new Error("Missing bound session");
  }
  await Promise.all(
    [0.002, 0.003].map(async (cost) => {
      const attempt = {
        eventId: crypto.randomUUID(),
        modelId: "mock-followup-model",
        provider: "mock",
        ownerId: owner,
        sessionId,
        turnId: "turn_0",
      };
      await eveModelLedger.begin(attempt);
      await Promise.all(
        Array.from({ length: 4 }, async () => {
          await eveModelLedger.finish(attempt, {
            usage: {
              inputTokens: {
                total: 1,
                noCache: 1,
                cacheRead: 0,
                cacheWrite: 0,
              },
              outputTokens: { total: 1, text: 1, reasoning: 0 },
            },
            providerMetadata: { gateway: { cost: String(cost) } },
          });
        })
      );
    })
  );
  const event: MessageStreamEvent = {
    data: {
      sequence: 0,
      turnId: "turn_0",
    },
    meta: { at: new Date().toISOString(), id: crypto.randomUUID() },
    type: "turn.completed",
  };
  await Promise.all(
    Array.from(
      { length: 4 },
      async () => await ingestEveUsage(owner, sessionId, event)
    )
  );
  const entries = await db
    .select()
    .from(eveUsage)
    .where(eq(eveUsage.sessionId, sessionId));
  expect(entries).toHaveLength(2);
  expect(
    entries.reduce(
      (sum, entry: { readonly costUsd: string | null }) =>
        sum + Number(entry.costUsd),
      0
    )
  ).toBe(0.005);
  expect(
    entries.reduce(
      (sum, entry: { readonly chargedCents: number }) =>
        sum + entry.chargedCents,
      0
    )
  ).toBe(1);
});

test("completed-copy capture fences a concurrent send and admits only one workspace operation", async () => {
  const source = await createEveConversation(
    owner,
    crypto.randomUUID(),
    "Source",
    createEveTestSession
  );
  const { readCompletedEveCopyTranscript } =
    await import("../lib/eve/completed-copy-source");
  const entered = Promise.withResolvers<null>();
  const release = Promise.withResolvers<null>();
  vi.mocked(readCompletedEveCopyTranscript).mockImplementationOnce(async () => {
    entered.resolve(null);
    await release.promise;
    return {
      seed: {
        messages: [
          {
            role: "user",
            parts: [{ type: "text", text: "Captured before send" }],
          },
        ],
      },
      projectionHash: "captured",
      resources: { fileKeys: [], documentIds: [], revisionIds: [] },
    };
  });
  const copyDispatch = vi.fn(createEveTestSession);
  const copying = createEveConversation(
    owner,
    crypto.randomUUID(),
    "Copy",
    copyDispatch,
    { fork: { conversationId: source.id } }
  );
  await entered.promise;
  const send = vi
    .fn<() => Promise<{ sessionId: string; deliveryId: string }>>()
    .mockResolvedValue({
      sessionId: source.sessionId,
      deliveryId: crypto.randomUUID(),
    });
  const sending = dispatchEveOnce(
    {
      ownerId: owner,
      operationId: crypto.randomUUID(),
      conversationId: source.id,
      kind: "send",
      intent: { message: "Concurrent" },
    },
    send
  );
  try {
    await delay(30);
    expect(send).not.toHaveBeenCalled();
  } finally {
    release.resolve(null);
  }
  const outcomes = await Promise.allSettled([copying, sending]);
  expect(
    outcomes.filter((outcome) => outcome.status === "fulfilled")
  ).toHaveLength(1);
  const rejected = outcomes.find((outcome) => outcome.status === "rejected");
  expect(rejected?.reason).toBeInstanceOf(EveWorkspaceBusyError);
  expect(copyDispatch.mock.calls.length + send.mock.calls.length).toBe(1);
});
