import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import type { PersistentSandboxProvider } from "@chat-js/sandboxes/persistent";
import type { SandboxScope } from "@chat-js/sandboxes/provider";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { databaseConnection } from "../db/connection";
import { env } from "../env";
import { evePersistentSandbox, eveSandboxSession } from "../db/schema";

// Remote operations hold their fence until settled; isolate them from app queries.
const connection = databaseConnection(env);
const db = drizzle(postgres(connection.url, { ...connection.options, max: 2 }));

interface SessionIdentity {
  sessionId: string;
  rootSessionId: string;
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
    sql`select pg_advisory_xact_lock(hashtextextended(${`chatjs-persistent:${root}`}, 0))`
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
const active = async (
  tx: Transaction,
  identity: SessionIdentity
): Promise<void> => {
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
    await lock(tx, identity.rootSessionId);
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
    await active(tx, identity);
  });
};

/** Commit intent before any remote allocation; a pending record never authorizes another create. */
export const reservePersistentSandbox = async (
  identity: SessionIdentity,
  scope: SandboxScope
): Promise<{ name: string; create: boolean }> => {
  const name = `chatjs-files-${createHash("sha256")
    .update(
      JSON.stringify([
        scope,
        identity.ownerId,
        identity.rootSessionId,
        identity.sessionId,
      ])
    )
    .digest("hex")
    .slice(0, 48)}`;
  return await db.transaction(async (tx) => {
    await lock(tx, identity.rootSessionId);
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
    await active(tx, identity);
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
      .where(eq(evePersistentSandbox.sessionId, identity.sessionId));
    if (previous.length > 0) {
      throw new Error(
        "Persistent sandbox provider replacement requires reconciliation."
      );
    }
    await tx.insert(evePersistentSandbox).values({
      name,
      sessionId: identity.sessionId,
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
    await lock(tx, identity.rootSessionId);
    await active(tx, identity);
    const resourceRows = await tx
      .select()
      .from(evePersistentSandbox)
      .where(eq(evePersistentSandbox.name, name));
    const resource = resourceRows.at(0);
    if (
      !resource ||
      resource.sessionId !== identity.sessionId ||
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
    await lock(tx, identity.rootSessionId);
    const rowRows = await tx
      .select()
      .from(eveSandboxSession)
      .where(eq(eveSandboxSession.sessionId, identity.sessionId));
    const row = rowRows.at(0);
    if (
      row &&
      (row.ownerId !== identity.ownerId ||
        row.rootSessionId !== identity.rootSessionId)
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
export const cleanupPersistentSession = async (
  identity: SessionIdentity,
  resolveProvider: ResolvePersistentProvider
): Promise<void> => {
  await db.transaction(async (tx) => {
    await lock(tx, identity.rootSessionId);
    const rowRows = await tx
      .select()
      .from(eveSandboxSession)
      .where(eq(eveSandboxSession.sessionId, identity.sessionId));
    const row = rowRows.at(0);
    if (
      !row ||
      row.ownerId !== identity.ownerId ||
      row.rootSessionId !== identity.rootSessionId ||
      row.state !== "retired"
    ) {
      throw new Error(
        "Persistent sandbox writers must be retired before deletion."
      );
    }
    const resources = await tx
      .select()
      .from(evePersistentSandbox)
      .where(eq(evePersistentSandbox.sessionId, identity.sessionId));
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
      // oxlint-disable-next-line eslint/no-await-in-loop -- Keep exact provider deletion and durable release ordered under the session fence.
      await provider.persistent.deleteAndConfirmAbsent(resource.name);
      // oxlint-disable-next-line eslint/no-await-in-loop -- Do not release ownership before confirmed provider absence.
      await tx
        .update(evePersistentSandbox)
        .set({ state: "deleted" })
        .where(eq(evePersistentSandbox.name, resource.name));
    }
  });
};

export const stopDevelopmentPersistentSandboxes = async (
  devRunId: string,
  resolveProvider: ResolvePersistentProvider
): Promise<void> => {
  const sessions = await db
    .select()
    .from(eveSandboxSession)
    .where(eq(eveSandboxSession.devRunId, devRunId));
  const failures: unknown[] = [];
  for (const identity of sessions) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- Stop one exact development owner's allocation at a time; keep failed ownership for retry.
    await db
      .transaction(async (tx) => {
        await lock(tx, identity.rootSessionId);
        const currentRows = await tx
          .select()
          .from(eveSandboxSession)
          .where(eq(eveSandboxSession.sessionId, identity.sessionId));
        const current = currentRows.at(0);
        if (current?.devRunId !== devRunId) {
          return;
        }
        const resources = await tx
          .select()
          .from(evePersistentSandbox)
          .where(eq(evePersistentSandbox.sessionId, identity.sessionId));
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
};
export type { SessionIdentity };
