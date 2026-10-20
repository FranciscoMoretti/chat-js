import { createHash } from "node:crypto";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import type { PersistentSandboxProvider } from "@chat-js/sandboxes/persistent";
import type { SandboxScope } from "@chat-js/sandboxes/provider";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { databaseConnection } from "../db/connection";
import { env } from "../env";
import {
  eveConversation,
  eveWorkspace,
  evePersistentSandbox,
  eveSandboxSession,
} from "../db/schema";

// Remote operations hold their fence until settled; isolate them from app queries.
const connection = databaseConnection(env);
const db = drizzle(postgres(connection.url, { ...connection.options, max: 2 }));

interface SessionIdentity {
  sessionId: string;
  rootSessionId: string;
  conversationId: string;
  workspaceId: string;
  ownerId: string;
  devRunId?: string;
}
type ResolvePersistentProvider = () => {
  scope: SandboxScope;
  persistent: Pick<
    PersistentSandboxProvider,
    "stop" | "deleteAndConfirmAbsent"
  >;
};
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Resource = typeof evePersistentSandbox.$inferSelect;
const lock = async (tx: Transaction, root: string): Promise<void> => {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`chatjs-workspace:${root}`}, 0))`
  );
};
const assertScope = (resource: Resource, scope: SandboxScope): void => {
  if (
    resource.providerId !== scope.providerId ||
    resource.accountId !== scope.accountId ||
    resource.scopeId !== scope.scopeId
  ) {
    throw new Error(
      "Persistent sandbox provider scope changed; reconcile before access."
    );
  }
};
export const assertActiveWorkspaceMembership = async (
  tx: Transaction,
  identity: SessionIdentity
): Promise<void> => {
  const [workspace] = await tx
    .select()
    .from(eveWorkspace)
    .where(
      and(
        eq(eveWorkspace.id, identity.workspaceId),
        eq(eveWorkspace.ownerId, identity.ownerId)
      )
    );
  const [conversation] = await tx
    .select()
    .from(eveConversation)
    .where(
      and(
        eq(eveConversation.id, identity.conversationId),
        eq(eveConversation.ownerId, identity.ownerId),
        eq(eveConversation.workspaceId, identity.workspaceId)
      )
    );
  if (
    workspace?.state !== "active" ||
    conversation === undefined ||
    !["creating", "bound", "uncertain"].includes(conversation.state)
  ) {
    throw new Error("Workspace membership is unavailable or retired.");
  }
  for (const sessionId of new Set([
    identity.rootSessionId,
    identity.sessionId,
  ])) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- Validate root and child under the same allocation fence.
    const rowRows = await tx
      .select()
      .from(eveSandboxSession)
      .where(eq(eveSandboxSession.sessionId, sessionId));
    const row = rowRows.at(0);
    if (
      !row ||
      row.ownerId !== identity.ownerId ||
      row.rootSessionId !== identity.rootSessionId ||
      row.conversationId !== identity.conversationId ||
      row.workspaceId !== identity.workspaceId ||
      row.state !== "active"
    ) {
      throw new Error(
        "Persistent sandbox session is retired or ownership changed."
      );
    }
  }
};
export const registerPersistentSession = async (
  identity: SessionIdentity
): Promise<void> => {
  await db.transaction(async (tx) => {
    await lock(tx, identity.workspaceId);
    for (const sessionId of new Set([
      identity.rootSessionId,
      identity.sessionId,
    ])) {
      // oxlint-disable-next-line eslint/no-await-in-loop -- Establish app ownership before resources can be allocated.
      await tx
        .insert(eveSandboxSession)
        .values({ ...identity, sessionId, state: "active" })
        .onConflictDoNothing();
    }
    await assertActiveWorkspaceMembership(tx, identity);
  });
};

/** Commit intent before any remote allocation; a pending record never authorizes another create. */
export const reservePersistentSandbox = async (
  identity: SessionIdentity,
  scope: SandboxScope
): Promise<{ name: string; create: boolean }> => {
  const name = `chatjs-files-${createHash("sha256")
    .update(JSON.stringify([scope, identity.ownerId, identity.workspaceId]))
    .digest("hex")
    .slice(0, 48)}`;
  return await db.transaction(async (tx) => {
    await lock(tx, identity.workspaceId);
    for (const sessionId of new Set([
      identity.rootSessionId,
      identity.sessionId,
    ])) {
      // oxlint-disable-next-line eslint/no-await-in-loop -- Register root and child atomically before allocation.
      await tx
        .insert(eveSandboxSession)
        .values({ ...identity, sessionId, state: "active" })
        .onConflictDoNothing();
    }
    await assertActiveWorkspaceMembership(tx, identity);
    const existingRows = await tx
      .select()
      .from(evePersistentSandbox)
      .where(eq(evePersistentSandbox.name, name));
    const existing = existingRows.at(0);
    if (existing) {
      assertScope(existing, scope);
      if (existing.state !== "ready") {
        throw new Error(
          "Persistent sandbox allocation is unresolved or deleted; automatic recreation is forbidden."
        );
      }
      return { name, create: false };
    }
    // A changed provider must not create an alternative allocation for this session.
    const previous = await tx
      .select()
      .from(evePersistentSandbox)
      .where(eq(evePersistentSandbox.workspaceId, identity.workspaceId));
    if (previous.length > 0) {
      throw new Error(
        "Persistent sandbox provider replacement requires reconciliation."
      );
    }
    await tx.insert(evePersistentSandbox).values({
      name,
      workspaceId: identity.workspaceId,
      ...scope,
      state: "pending",
    });
    return { name, create: true };
  });
};
/** Serialize provider access against retirement; provider calls must have bounded deadlines. */
export const accessPersistentSandbox = async <T>(
  identity: SessionIdentity,
  scope: SandboxScope,
  name: string,
  operation: () => Promise<T>,
  creating = false
): Promise<T> =>
  await db.transaction(async (tx) => {
    await lock(tx, identity.workspaceId);
    await assertActiveWorkspaceMembership(tx, identity);
    const resourceRows = await tx
      .select()
      .from(evePersistentSandbox)
      .where(eq(evePersistentSandbox.name, name));
    const resource = resourceRows.at(0);
    if (
      !resource ||
      resource.workspaceId !== identity.workspaceId ||
      resource.state !== (creating ? "pending" : "ready")
    ) {
      throw new Error("Persistent sandbox allocation is not available.");
    }
    assertScope(resource, scope);
    if (identity.devRunId !== undefined) {
      await tx
        .update(eveSandboxSession)
        .set({ devRunId: identity.devRunId })
        .where(eq(eveSandboxSession.sessionId, identity.sessionId));
    }
    const result = await operation();
    if (creating) {
      await tx
        .update(evePersistentSandbox)
        .set({ state: "ready" })
        .where(eq(evePersistentSandbox.name, name));
    }
    return result;
  });

export const readPersistentIdentity = async (
  sessionId: string
): Promise<SessionIdentity | null> => {
  const rowRows = await db
    .select()
    .from(eveSandboxSession)
    .where(eq(eveSandboxSession.sessionId, sessionId));
  const row = rowRows.at(0);
  return row ? { ...row, devRunId: row.devRunId ?? undefined } : null;
};

/** Retain a tombstone even if this session never allocated a filesystem. */
export const retirePersistentSession = async (
  identity: SessionIdentity
): Promise<void> => {
  await db.transaction(async (tx) => {
    await lock(tx, identity.workspaceId);
    const rowRows = await tx
      .select()
      .from(eveSandboxSession)
      .where(eq(eveSandboxSession.sessionId, identity.sessionId));
    const row = rowRows.at(0);
    if (
      row &&
      (row.ownerId !== identity.ownerId ||
        row.rootSessionId !== identity.rootSessionId ||
        row.workspaceId !== identity.workspaceId ||
        row.conversationId !== identity.conversationId)
    ) {
      throw new Error("Persistent sandbox retirement owner mismatch.");
    }
    await tx
      .insert(eveSandboxSession)
      .values({ ...identity, state: "retired" })
      .onConflictDoUpdate({
        target: eveSandboxSession.sessionId,
        set: { state: "retired" },
      });
  });
};
/** Explicit deletion is permitted only after all conversations were retired. */
export const cleanupWorkspaceIfUnused = async (
  ownerId: string,
  workspaceId: string,
  resolveProvider: ResolvePersistentProvider,
  explicit = false
): Promise<void> => {
  await db.transaction(async (tx) => {
    await lock(tx, workspaceId);
    const [workspace] = await tx
      .select()
      .from(eveWorkspace)
      .where(
        and(eq(eveWorkspace.id, workspaceId), eq(eveWorkspace.ownerId, ownerId))
      );
    if (workspace === undefined) {
      throw new Error("Workspace ownership is unavailable.");
    }
    if (workspace.state === "deleted") {
      return;
    }
    const members = await tx
      .select({ id: eveConversation.id })
      .from(eveConversation)
      .where(
        and(
          eq(eveConversation.workspaceId, workspaceId),
          ne(eveConversation.state, "deleted"),
          ne(eveConversation.state, "deleting")
        )
      )
      .limit(1);
    if (members.length > 0) {
      if (explicit) {
        throw new Error(
          "Delete attached conversations before deleting this workspace."
        );
      }
      return;
    }
    if (workspace.activeOperationId !== null) {
      throw new Error("Workspace turn retirement is incomplete.");
    }
    const writers = await tx
      .select({ id: eveSandboxSession.sessionId })
      .from(eveSandboxSession)
      .where(
        and(
          eq(eveSandboxSession.workspaceId, workspaceId),
          eq(eveSandboxSession.state, "active")
        )
      )
      .limit(1);
    if (writers.length > 0) {
      throw new Error("Workspace writers must be retired before deletion.");
    }
    const resources = await tx
      .select()
      .from(evePersistentSandbox)
      .where(eq(evePersistentSandbox.workspaceId, workspaceId));
    await tx
      .update(eveWorkspace)
      .set({ state: "deleting" })
      .where(eq(eveWorkspace.id, workspaceId));
    for (const resource of resources) {
      if (resource.state === "pending") {
        throw new Error(
          "Resolve uncertain persistent sandbox allocation before deletion."
        );
      }
      if (resource.state === "deleted") {
        continue;
      }
      const provider = resolveProvider();
      assertScope(resource, provider.scope);
      // oxlint-disable-next-line eslint/no-await-in-loop -- Confirm exact provider absence before committing workspace tombstones.
      await provider.persistent.deleteAndConfirmAbsent(resource.name);
      // oxlint-disable-next-line eslint/no-await-in-loop -- Retain unresolved ownership if deletion fails.
      await tx
        .update(evePersistentSandbox)
        .set({ state: "deleted" })
        .where(eq(evePersistentSandbox.name, resource.name));
    }
    await tx
      .update(eveWorkspace)
      .set({ state: "deleted" })
      .where(eq(eveWorkspace.id, workspaceId));
  });
};

/** Detachment never deletes a workspace retained by another conversation. */
export const cleanupPersistentSession = async (
  identity: SessionIdentity,
  resolveProvider: ResolvePersistentProvider
): Promise<void> => {
  await cleanupWorkspaceIfUnused(
    identity.ownerId,
    identity.workspaceId,
    resolveProvider
  );
};

/** Session completion is not workspace deletion, and cannot stop another conversation's active turn. */
export const stopPersistentWorkspace = async (
  identity: SessionIdentity,
  resolveProvider: ResolvePersistentProvider
): Promise<void> => {
  await db.transaction(async (tx) => {
    await lock(tx, identity.workspaceId);
    await assertActiveWorkspaceMembership(tx, identity);
    const [workspace] = await tx
      .select()
      .from(eveWorkspace)
      .where(eq(eveWorkspace.id, identity.workspaceId));
    if (workspace?.activeOperationId !== null) {
      return;
    }
    const resources = await tx
      .select()
      .from(evePersistentSandbox)
      .where(eq(evePersistentSandbox.workspaceId, identity.workspaceId));
    for (const resource of resources) {
      if (resource.state !== "ready") {
        continue;
      }
      const provider = resolveProvider();
      assertScope(resource, provider.scope);
      // oxlint-disable-next-line eslint/no-await-in-loop -- Stop only exact owned allocations under the shared workspace fence.
      await provider.persistent.stop(resource.name);
    }
  });
};

/** Called only after this development run's workers are terminated. Durable dispatch fences survive shutdown. */
export const stopDevelopmentPersistentSandboxes = async (
  devRunId: string,
  resolveProvider: ResolvePersistentProvider
): Promise<{ deferredWorkspaceIds: string[] }> => {
  const sessions = await db
    .select()
    .from(eveSandboxSession)
    .where(eq(eveSandboxSession.devRunId, devRunId));
  const failures: unknown[] = [];
  const deferredWorkspaceIds = new Set<string>();
  for (const identity of sessions) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- Stop one exact development owner's allocation at a time; keep failed ownership for retry.
    await db
      .transaction(async (tx) => {
        await lock(tx, identity.workspaceId);
        const currentRows = await tx
          .select()
          .from(eveSandboxSession)
          .where(eq(eveSandboxSession.sessionId, identity.sessionId));
        const current = currentRows.at(0);
        if (current?.devRunId !== devRunId) {
          return;
        }
        const [workspace] = await tx
          .select()
          .from(eveWorkspace)
          .where(eq(eveWorkspace.id, identity.workspaceId));
        if (workspace?.activeOperationId !== null) {
          // The server is already stopped, so native evidence cannot be read here.
          // Keep the shared allocation and dispatch fence for restarted workers;
          // neither a known-but-unreconciled send nor unknown delivery authorizes redispatch.
          await tx
            .update(eveSandboxSession)
            .set({ devRunId: null })
            .where(eq(eveSandboxSession.sessionId, identity.sessionId));
          deferredWorkspaceIds.add(identity.workspaceId);
          return;
        }
        const resources = await tx
          .select()
          .from(evePersistentSandbox)
          .where(eq(evePersistentSandbox.workspaceId, identity.workspaceId));
        for (const resource of resources) {
          if (resource.state === "pending") {
            throw new Error(
              "Uncertain persistent allocation needs reconciliation before shutdown is confirmed."
            );
          }
          if (resource.state === "deleted") {
            continue;
          }
          const provider = resolveProvider();
          assertScope(resource, provider.scope);
          // oxlint-disable-next-line eslint/no-await-in-loop -- Provider stop must finish before detaching this development lease.
          await provider.persistent.stop(resource.name);
        }
        await tx
          .update(eveSandboxSession)
          .set({ devRunId: null })
          .where(eq(eveSandboxSession.sessionId, identity.sessionId));
      })
      .catch((error: unknown) => {
        failures.push(error);
      });
  }
  if (failures.length > 0) {
    throw new AggregateError(
      failures,
      `Persistent sandbox shutdown is incomplete: ${failures.map(String).join("; ")}`
    );
  }
  return { deferredWorkspaceIds: [...deferredWorkspaceIds].toSorted() };
};
export type { SessionIdentity };

/** Resolve only trusted native lineage or the gateway-authenticated creation reservation. */
export const resolvePersistentIdentity = async (input: {
  sessionId: string;
  rootSessionId: string;
  ownerId?: string;
  reservationId?: string;
  devRunId?: string;
}): Promise<SessionIdentity> => {
  const saved = await readPersistentIdentity(input.sessionId);
  if (saved) {
    if (
      (input.ownerId !== undefined && saved.ownerId !== input.ownerId) ||
      saved.rootSessionId !== input.rootSessionId
    ) {
      throw new Error("Persistent sandbox owner or native lineage changed.");
    }
    return { ...saved, devRunId: input.devRunId };
  }
  const [conversation] = await db
    .select()
    .from(eveConversation)
    .where(
      input.reservationId === undefined
        ? eq(eveConversation.sessionId, input.rootSessionId)
        : eq(eveConversation.id, input.reservationId)
    );
  if (
    conversation === undefined ||
    input.ownerId !== conversation.ownerId ||
    !["creating", "bound", "uncertain", "deleting"].includes(
      conversation.state
    ) ||
    (conversation.sessionId !== null &&
      conversation.sessionId !== input.rootSessionId)
  ) {
    throw new Error(
      "Persistent sandbox conversation ownership is unavailable."
    );
  }
  return {
    ...input,
    ownerId: conversation.ownerId,
    workspaceId: conversation.workspaceId,
    conversationId: conversation.id,
  };
};

/** Finalization requires retired native members; shared resources may survive only for other live conversations. */
export const checkDeletedWorkspaceMemberships = async (
  ownerId: string,
  conversationIds: readonly string[]
): Promise<void> => {
  await db.transaction(async (tx) => {
    const conversations = await tx
      .select()
      .from(eveConversation)
      .where(
        and(
          eq(eveConversation.ownerId, ownerId),
          inArray(eveConversation.id, [...conversationIds])
        )
      );
    if (
      conversations.length !== new Set(conversationIds).size ||
      conversations.some(
        (member) => !["deleting", "deleted"].includes(member.state)
      )
    ) {
      throw new Error("Workspace membership deletion is not authorized.");
    }
    for (const workspaceId of [
      ...new Set(conversations.map((member) => member.workspaceId)),
    ].toSorted()) {
      // oxlint-disable-next-line eslint/no-await-in-loop -- Consistent workspace order serializes finalization with provider operations.
      await lock(tx, workspaceId);
      // oxlint-disable-next-line eslint/no-await-in-loop -- Every retired member must be fenced before finalization.
      const writers = await tx
        .select({ id: eveSandboxSession.sessionId })
        .from(eveSandboxSession)
        .where(
          and(
            inArray(eveSandboxSession.conversationId, [...conversationIds]),
            eq(eveSandboxSession.workspaceId, workspaceId),
            eq(eveSandboxSession.state, "active")
          )
        )
        .limit(1);
      if (writers.length > 0) {
        throw new Error("Workspace session retirement is incomplete.");
      }
      // oxlint-disable-next-line eslint/no-await-in-loop -- Read cleanup eligibility under the same workspace lock.
      const live = await tx
        .select({ id: eveConversation.id })
        .from(eveConversation)
        .where(
          and(
            eq(eveConversation.workspaceId, workspaceId),
            ne(eveConversation.state, "deleted"),
            ne(eveConversation.state, "deleting")
          )
        )
        .limit(1);
      if (live.length > 0) {
        continue;
      }
      // oxlint-disable-next-line eslint/no-await-in-loop -- Last-member cleanup must have committed its workspace tombstone.
      const [workspace] = await tx
        .select()
        .from(eveWorkspace)
        .where(
          and(
            eq(eveWorkspace.id, workspaceId),
            eq(eveWorkspace.ownerId, ownerId)
          )
        );
      if (workspace?.state !== "deleted") {
        throw new Error("Workspace cleanup is incomplete.");
      }
    }
  });
};
