import { afterAll, beforeAll, expect, test, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db } from "../lib/db/client";
import { env } from "../lib/env";
import {
  user,
  eveChat,
  eveConversation,
  eveWorkspace,
  evePersistentSandbox,
  eveSandboxSession,
} from "../lib/db/schema";
import { assertEveTestDatabase } from "./eve-test-database";
import {
  reservePersistentSandbox,
  accessPersistentSandbox,
  retirePersistentSession as retireSession,
  resolvePersistentIdentity,
  cleanupWorkspaceIfUnused,
  checkDeletedWorkspaceMemberships,
  cleanupPersistentSession,
  stopDevelopmentPersistentSandboxes,
  stopPersistentWorkspace,
} from "../lib/eve/persistent-sandbox-store";

assertEveTestDatabase(env.DATABASE_URL);
const scope = {
  providerId: "vercel",
  accountId: "fixture",
  scopeId: "fixture",
};
const resolver = (operation: (name: string) => Promise<void>) => () => ({
  scope,
  persistent: { stop: operation, deleteAndConfirmAbsent: operation },
});
const sessions: string[] = [];
const workspaces: string[] = [];
const conversations: string[] = [];
const chats: string[] = [];
const ownerId = crypto.randomUUID();
beforeAll(async () => {
  await db.insert(user).values({
    id: ownerId,
    name: "workspace fixture",
    email: `${ownerId}@example.test`,
  });
});
const identity = async (sharedWorkspaceId?: string) => {
  const sessionId = crypto.randomUUID();
  const conversationId = crypto.randomUUID();
  const chatId = crypto.randomUUID();
  const workspaceId = sharedWorkspaceId ?? crypto.randomUUID();
  if (sharedWorkspaceId === undefined) {
    await db.insert(eveWorkspace).values({ id: workspaceId, ownerId });
    workspaces.push(workspaceId);
  }
  await db.insert(eveChat).values({ id: chatId, ownerId, title: "fixture" });
  chats.push(chatId);
  await db.insert(eveConversation).values({
    id: conversationId,
    chatId,
    workspaceId,
    ownerId,
    firstMessage: "fixture",
    operationId: crypto.randomUUID(),
    sessionId,
    state: "bound",
  });
  conversations.push(conversationId);
  sessions.push(sessionId);
  return {
    sessionId,
    rootSessionId: sessionId,
    conversationId,
    workspaceId,
    ownerId,
    devRunId: crypto.randomUUID(),
  };
};
const retirePersistentSession = async (
  id: Awaited<ReturnType<typeof identity>>
) => {
  await retireSession(id);
  await db
    .update(eveConversation)
    .set({ state: "deleting" })
    .where(eq(eveConversation.id, id.conversationId));
};
afterAll(async () => {
  await db
    .delete(evePersistentSandbox)
    .where(inArray(evePersistentSandbox.workspaceId, workspaces));
  await db
    .delete(eveSandboxSession)
    .where(inArray(eveSandboxSession.workspaceId, workspaces));
  await db
    .delete(eveConversation)
    .where(inArray(eveConversation.id, conversations));
  await db.delete(eveChat).where(inArray(eveChat.id, chats));
  await db.delete(eveWorkspace).where(inArray(eveWorkspace.id, workspaces));
  await db.delete(user).where(eq(user.id, ownerId));
});
test("interrupted creation stays unknown even after retirement; no missing lookup clears it", async () => {
  const id = await identity();
  const allocation = await reservePersistentSandbox(id, scope);
  await expect(reservePersistentSandbox(id, scope)).rejects.toThrow(
    "unresolved"
  );
  await retirePersistentSession(id);
  const remove = vi.fn();
  await expect(cleanupPersistentSession(id, resolver(remove))).rejects.toThrow(
    "uncertain"
  );
  expect(remove).not.toHaveBeenCalled();
  expect(allocation.create).toBe(true);
});
test("known create can resume without reallocation; wrong scopes and retired cached handles fail", async () => {
  const id = await identity();
  const allocation = await reservePersistentSandbox(id, scope);
  await accessPersistentSandbox(
    id,
    scope,
    allocation.name,
    async () => {
      await Promise.resolve();
    },
    true
  );
  expect(await reservePersistentSandbox(id, scope)).toEqual({
    name: allocation.name,
    create: false,
  });
  await expect(
    reservePersistentSandbox(id, { ...scope, scopeId: "foreign" })
  ).rejects.toThrow("replacement");
  const operation = vi.fn();
  await expect(
    accessPersistentSandbox(
      id,
      { ...scope, scopeId: "foreign" },
      allocation.name,
      operation
    )
  ).rejects.toThrow("scope changed");
  await retirePersistentSession(id);
  await expect(
    accessPersistentSandbox(id, scope, allocation.name, operation)
  ).rejects.toThrow("retired");
  expect(operation).not.toHaveBeenCalled();
  const remove = vi.fn(async () => {
    await Promise.resolve();
  });
  await cleanupPersistentSession(id, resolver(remove));
  await cleanupPersistentSession(id, resolver(remove));
  expect(remove).toHaveBeenCalledExactlyOnceWith(allocation.name);
});
test("retirement waits for an in-flight provider operation before allowing deletion", async () => {
  const id = await identity();
  const allocation = await reservePersistentSandbox(id, scope);
  await accessPersistentSandbox(
    id,
    scope,
    allocation.name,
    async () => {
      await Promise.resolve();
    },
    true
  );
  const entered = Promise.withResolvers<boolean>();
  const release = Promise.withResolvers<boolean>();
  const order: string[] = [];
  const writer = accessPersistentSandbox(
    id,
    scope,
    allocation.name,
    async () => {
      entered.resolve(true);
      await release.promise;
      order.push("writer settled");
    }
  );
  await entered.promise;
  const retired = (async () => {
    await retirePersistentSession(id);
    order.push("retired");
  })();
  release.resolve(true);
  await Promise.all([writer, retired]);
  await cleanupPersistentSession(
    id,
    resolver(async () => {
      await Promise.resolve();
      order.push("deleted");
    })
  );
  expect(order).toEqual(["writer settled", "retired", "deleted"]);
});
test("shutdown stops only its dev run and retains files/ownership for resume", async () => {
  const id = await identity();
  const allocation = await reservePersistentSandbox(id, scope);
  await accessPersistentSandbox(
    id,
    scope,
    allocation.name,
    async () => {
      await Promise.resolve();
    },
    true
  );
  const stop = vi.fn(async () => {
    await Promise.resolve();
  });
  await stopDevelopmentPersistentSandboxes("another-run", resolver(stop));
  expect(stop).not.toHaveBeenCalled();
  await stopDevelopmentPersistentSandboxes(id.devRunId, resolver(stop));
  expect(stop).toHaveBeenCalledExactlyOnceWith(allocation.name);
  const resumed = await reservePersistentSandbox(id, scope);
  expect(resumed.create).toBe(false);
});

test("an unresolved allocation does not prevent stopping other sessions in the run", async () => {
  const unresolved = await identity();
  await reservePersistentSandbox(unresolved, scope);
  const ready = { ...(await identity()), devRunId: unresolved.devRunId };
  const allocation = await reservePersistentSandbox(ready, scope);
  await accessPersistentSandbox(
    ready,
    scope,
    allocation.name,
    async () => {
      await Promise.resolve();
    },
    true
  );
  const stop = vi.fn<() => Promise<void>>().mockResolvedValue();
  await expect(
    stopDevelopmentPersistentSandboxes(unresolved.devRunId, resolver(stop))
  ).rejects.toThrow("Uncertain");
  expect(stop).toHaveBeenCalledExactlyOnceWith(allocation.name);
  stop.mockClear();
  await expect(
    stopDevelopmentPersistentSandboxes(unresolved.devRunId, resolver(stop))
  ).rejects.toThrow("Uncertain");
  expect(stop).not.toHaveBeenCalled();
});
test("retiring a root blocks a child's cached handles and new allocations", async () => {
  const root = await identity();
  const child = { ...root, sessionId: crypto.randomUUID() };
  sessions.push(child.sessionId);
  const allocation = await reservePersistentSandbox(child, scope);
  await accessPersistentSandbox(
    child,
    scope,
    allocation.name,
    async () => {
      await Promise.resolve();
    },
    true
  );
  await retirePersistentSession(root);
  await expect(
    accessPersistentSandbox(child, scope, allocation.name, async () => {
      await Promise.resolve();
    })
  ).rejects.toThrow("retired");
});

test("empty and already deleted sessions require no provider, but owned resources do", async () => {
  const id = await identity();
  const missing = vi.fn((): never => {
    throw new Error("No provider installed");
  });
  await retirePersistentSession(id);
  await cleanupPersistentSession(id, missing);
  await stopDevelopmentPersistentSandboxes(id.devRunId, missing);
  expect(missing).not.toHaveBeenCalled();

  const owned = await identity();
  const allocation = await reservePersistentSandbox(owned, scope);
  await accessPersistentSandbox(
    owned,
    scope,
    allocation.name,
    async () => {
      await Promise.resolve();
    },
    true
  );
  await expect(
    stopDevelopmentPersistentSandboxes(owned.devRunId, missing)
  ).rejects.toThrow("No provider");
  await retirePersistentSession(owned);
  await expect(cleanupPersistentSession(owned, missing)).rejects.toThrow(
    "No provider"
  );
  const wrong = () => ({
    ...resolver(async () => {
      await Promise.resolve();
    })(),
    scope: { ...scope, scopeId: "foreign" },
  });
  await expect(cleanupPersistentSession(owned, wrong)).rejects.toThrow(
    "scope changed"
  );
  await cleanupPersistentSession(
    owned,
    resolver(async () => {
      await Promise.resolve();
    })
  );
  missing.mockClear();
  await cleanupPersistentSession(owned, missing);
  expect(missing).not.toHaveBeenCalled();
});

test("fork membership shares one allocation; retiring the original preserves the fork and last release deletes", async () => {
  const original = await identity();
  const fork = await identity(original.workspaceId);
  const allocation = await reservePersistentSandbox(original, scope);
  await accessPersistentSandbox(
    original,
    scope,
    allocation.name,
    async () => {
      await Promise.resolve();
    },
    true
  );
  expect(await reservePersistentSandbox(fork, scope)).toEqual({
    name: allocation.name,
    create: false,
  });
  const remove = vi.fn<() => Promise<void>>().mockResolvedValue();
  await expect(
    cleanupWorkspaceIfUnused(
      original.ownerId,
      original.workspaceId,
      resolver(remove),
      true
    )
  ).rejects.toThrow("attached conversations");
  await retirePersistentSession(original);
  await cleanupPersistentSession(original, resolver(remove));
  await checkDeletedWorkspaceMemberships(ownerId, [original.conversationId]);
  expect(remove).not.toHaveBeenCalled();
  await expect(
    accessPersistentSandbox(original, scope, allocation.name, async () => {
      await Promise.resolve();
    })
  ).rejects.toThrow("retired");
  await accessPersistentSandbox(fork, scope, allocation.name, async () => {
    await Promise.resolve();
  });
  await expect(
    accessPersistentSandbox(
      { ...fork, ownerId: "foreign" },
      scope,
      allocation.name,
      async () => {
        await Promise.resolve();
      }
    )
  ).rejects.toThrow("membership");
  expect(
    await resolvePersistentIdentity({
      sessionId: fork.sessionId,
      rootSessionId: fork.rootSessionId,
      ownerId,
    })
  ).toMatchObject({
    workspaceId: fork.workspaceId,
    conversationId: fork.conversationId,
  });
  await retirePersistentSession(fork);
  await expect(
    checkDeletedWorkspaceMemberships(ownerId, [fork.conversationId])
  ).rejects.toThrow("cleanup is incomplete");
  await cleanupPersistentSession(fork, resolver(remove));
  await checkDeletedWorkspaceMemberships(ownerId, [
    original.conversationId,
    fork.conversationId,
  ]);
  expect(remove).toHaveBeenCalledExactlyOnceWith(allocation.name);
  const [workspace] = await db
    .select()
    .from(eveWorkspace)
    .where(eq(eveWorkspace.id, fork.workspaceId));
  expect(workspace?.state).toBe("deleted");
});

test("trusted reservation resolves workspace before binding and native children inherit it", async () => {
  const id = await identity();
  await db
    .update(eveConversation)
    .set({ sessionId: null, state: "creating" })
    .where(eq(eveConversation.id, id.conversationId));
  const input = {
    sessionId: id.sessionId,
    rootSessionId: id.rootSessionId,
    ownerId,
    reservationId: id.conversationId,
  };
  expect(await resolvePersistentIdentity(input)).toMatchObject({
    workspaceId: id.workspaceId,
    conversationId: id.conversationId,
  });
  await expect(
    resolvePersistentIdentity({ ...input, ownerId: "foreign" })
  ).rejects.toThrow("ownership");
  await expect(
    resolvePersistentIdentity({ ...input, reservationId: crypto.randomUUID() })
  ).rejects.toThrow("ownership");
  const allocation = await reservePersistentSandbox(id, scope);
  await accessPersistentSandbox(
    id,
    scope,
    allocation.name,
    async () => {
      await Promise.resolve();
    },
    true
  );
  await db
    .update(eveConversation)
    .set({ sessionId: id.sessionId, state: "bound" })
    .where(eq(eveConversation.id, id.conversationId));
  const child = await resolvePersistentIdentity({
    ...input,
    sessionId: crypto.randomUUID(),
  });
  expect(child).toMatchObject({
    workspaceId: id.workspaceId,
    conversationId: id.conversationId,
    rootSessionId: id.sessionId,
  });
  expect(await reservePersistentSandbox(child, scope)).toEqual({
    name: allocation.name,
    create: false,
  });
  await retireSession(child);
  await accessPersistentSandbox(id, scope, allocation.name, async () => {
    await Promise.resolve();
  });
  await retirePersistentSession(id);
  await cleanupPersistentSession(
    id,
    resolver(async () => {
      await Promise.resolve();
    })
  );
});

test("text-only sessions resolve retirement without prior provider registration", async () => {
  const id = await identity();
  await db
    .update(eveConversation)
    .set({ state: "deleting" })
    .where(eq(eveConversation.id, id.conversationId));
  const resolved = await resolvePersistentIdentity({
    sessionId: id.sessionId,
    rootSessionId: id.rootSessionId,
    ownerId,
  });
  expect(resolved).toMatchObject({
    conversationId: id.conversationId,
    workspaceId: id.workspaceId,
  });
  await retireSession(resolved);
  const missing = vi.fn((): never => {
    throw new Error("No provider installed");
  });
  await cleanupPersistentSession(resolved, missing);
  await checkDeletedWorkspaceMemberships(ownerId, [id.conversationId]);
  expect(missing).not.toHaveBeenCalled();
  const [workspace] = await db
    .select()
    .from(eveWorkspace)
    .where(eq(eveWorkspace.id, id.workspaceId));
  expect(workspace?.state).toBe("deleted");
});

test("another conversation's active turn fences stop callbacks and last-member cleanup", async () => {
  const original = await identity();
  const fork = await identity(original.workspaceId);
  const allocation = await reservePersistentSandbox(original, scope);
  await accessPersistentSandbox(
    original,
    scope,
    allocation.name,
    async () => {
      await Promise.resolve();
    },
    true
  );
  await reservePersistentSandbox(fork, scope);
  const operationId = crypto.randomUUID();
  await db
    .update(eveWorkspace)
    .set({ activeOperationId: operationId })
    .where(eq(eveWorkspace.id, original.workspaceId));
  const providerCall = vi.fn<() => Promise<void>>().mockResolvedValue();
  await stopPersistentWorkspace(original, resolver(providerCall));
  await retirePersistentSession(original);
  await cleanupPersistentSession(original, resolver(providerCall));
  await accessPersistentSandbox(fork, scope, allocation.name, async () => {
    await Promise.resolve();
  });
  await retirePersistentSession(fork);
  await expect(
    cleanupPersistentSession(fork, resolver(providerCall))
  ).rejects.toThrow("turn retirement is incomplete");
  expect(providerCall).not.toHaveBeenCalled();
  const [workspace] = await db
    .select()
    .from(eveWorkspace)
    .where(eq(eveWorkspace.id, original.workspaceId));
  expect(workspace?.activeOperationId).toBe(operationId);
  expect(workspace?.state).toBe("active");
});

test("terminated development workers defer gated workspaces without clearing delivery or allocation fencing", async () => {
  const id = await identity();
  const fork = { ...(await identity(id.workspaceId)), devRunId: id.devRunId };
  const allocation = await reservePersistentSandbox(id, scope);
  await accessPersistentSandbox(
    id,
    scope,
    allocation.name,
    async () => {
      await Promise.resolve();
    },
    true
  );
  await reservePersistentSandbox(fork, scope);
  const operationId = crypto.randomUUID();
  await db
    .update(eveWorkspace)
    .set({ activeOperationId: operationId })
    .where(eq(eveWorkspace.id, id.workspaceId));
  const pending = { ...(await identity()), devRunId: id.devRunId };
  await reservePersistentSandbox(pending, scope);
  await db
    .update(eveWorkspace)
    .set({ activeOperationId: crypto.randomUUID() })
    .where(eq(eveWorkspace.id, pending.workspaceId));
  const idle = { ...(await identity()), devRunId: id.devRunId };
  const idleAllocation = await reservePersistentSandbox(idle, scope);
  await accessPersistentSandbox(
    idle,
    scope,
    idleAllocation.name,
    async () => {
      await Promise.resolve();
    },
    true
  );
  const stop = vi.fn<() => Promise<void>>().mockResolvedValue();
  expect(
    await stopDevelopmentPersistentSandboxes(id.devRunId, resolver(stop))
  ).toEqual({
    deferredWorkspaceIds: [id.workspaceId, pending.workspaceId].toSorted(),
  });
  expect(stop).toHaveBeenCalledExactlyOnceWith(idleAllocation.name);
  const [workspace] = await db
    .select()
    .from(eveWorkspace)
    .where(eq(eveWorkspace.id, id.workspaceId));
  expect(workspace.activeOperationId).toBe(operationId);
  const [membership] = await db
    .select()
    .from(eveSandboxSession)
    .where(eq(eveSandboxSession.sessionId, id.sessionId));
  expect(membership.devRunId).toBeNull();
  expect(membership.state).toBe("active");
  const restarted = { ...id, devRunId: crypto.randomUUID() };
  expect(await reservePersistentSandbox(restarted, scope)).toEqual({
    name: allocation.name,
    create: false,
  });
  await accessPersistentSandbox(restarted, scope, allocation.name, async () => {
    await Promise.resolve();
  });
  const [resumed] = await db
    .select()
    .from(eveSandboxSession)
    .where(eq(eveSandboxSession.sessionId, id.sessionId));
  expect(resumed.devRunId).toBe(restarted.devRunId);
  await expect(
    reservePersistentSandbox(
      { ...pending, devRunId: restarted.devRunId },
      scope
    )
  ).rejects.toThrow("unresolved");
  expect(
    await stopDevelopmentPersistentSandboxes(id.devRunId, resolver(stop))
  ).toEqual({ deferredWorkspaceIds: [] });
  expect(stop).toHaveBeenCalledOnce();
});
