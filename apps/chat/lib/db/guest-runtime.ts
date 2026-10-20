import { and, eq, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "./client";
import { guestRuntimeRate, guestRuntimeSession } from "./schema";

type GuestTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
const hash = z.string().regex(/^[0-9a-f]{64}$/u);
const positiveLimit = z.number().int().positive();

const rateBucket = async (
  tx: GuestTransaction,
  ipHash: string,
  kind: "session" | "message"
) => {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtext(${`guest-runtime:${kind}:${ipHash}`}))`
  );
  const [clock] = await tx
    .select({
      startsAt:
        sql<Date>`date_trunc(${kind === "session" ? "hour" : "minute"}, now())`.mapWith(
          guestRuntimeRate.startsAt
        ),
    })
    .from(sql`(select 1) as clock`);
  if (typeof clock !== "object") {
    throw new TypeError("Database clock unavailable.");
  }
  const key = { ipHash, kind, startsAt: clock.startsAt };
  const [row] = await tx
    .select()
    .from(guestRuntimeRate)
    .where(
      and(
        eq(guestRuntimeRate.ipHash, ipHash),
        eq(guestRuntimeRate.kind, kind),
        eq(guestRuntimeRate.startsAt, key.startsAt)
      )
    );
  return { key, requests: row?.requests ?? 0 };
};

const incrementRate = async (
  tx: GuestTransaction,
  key: typeof guestRuntimeRate.$inferInsert
): Promise<void> => {
  await tx
    .insert(guestRuntimeRate)
    .values({ ...key, requests: 1 })
    .onConflictDoUpdate({
      target: [
        guestRuntimeRate.ipHash,
        guestRuntimeRate.kind,
        guestRuntimeRate.startsAt,
      ],
      set: { requests: sql`${guestRuntimeRate.requests} + 1` },
    });
};

export const createGuestRuntimeSession = async (input: {
  ownerId: string;
  modelId: string;
  ipHash: string;
  credentialExpiresAt: Date;
  messageLimit: number;
  requestsPerMinute: number;
  sessionsPerHour: number;
}) => {
  hash.parse(input.ipHash);
  positiveLimit.parse(input.messageLimit);
  positiveLimit.parse(input.requestsPerMinute);
  positiveLimit.parse(input.sessionsPerHour);
  z.string().min(1).parse(input.ownerId);
  z.string().min(1).parse(input.modelId);
  if (
    !Number.isFinite(input.credentialExpiresAt.getTime()) ||
    input.credentialExpiresAt <= new Date()
  ) {
    throw new Error("Guest credential expiry must be in the future.");
  }
  return await db.transaction(async (tx) => {
    const bucket = await rateBucket(tx, input.ipHash, "session");
    if (bucket.requests >= input.sessionsPerHour) {
      return { status: "rate-limited" } as const;
    }
    const [guest] = await tx
      .insert(guestRuntimeSession)
      .values({
        ownerId: input.ownerId,
        modelId: input.modelId,
        ipHash: input.ipHash,
        credentialExpiresAt: input.credentialExpiresAt,
        messageLimit: input.messageLimit,
      })
      .returning();
    if (typeof guest !== "object") {
      throw new TypeError("Guest policy creation failed.");
    }
    await incrementRate(tx, bucket.key);
    return { status: "ready", guest } as const;
  });
};

export const bindGuestRuntimeSession = async (
  id: string,
  ownerId: string,
  sessionId: string
): Promise<boolean> => {
  z.string().min(1).parse(sessionId);
  const rows = await db
    .update(guestRuntimeSession)
    .set({ sessionId })
    .where(
      and(
        eq(guestRuntimeSession.id, id),
        eq(guestRuntimeSession.ownerId, ownerId),
        eq(guestRuntimeSession.state, "active"),
        sql`${guestRuntimeSession.credentialExpiresAt} > now()`,
        or(
          isNull(guestRuntimeSession.sessionId),
          eq(guestRuntimeSession.sessionId, sessionId)
        )
      )
    )
    .returning({ id: guestRuntimeSession.id });
  return rows.length === 1;
};

export const readGuestRuntimePolicy = async (
  id: string,
  ownerId: string
): Promise<typeof guestRuntimeSession.$inferSelect | null> => {
  const [guest] = await db
    .select()
    .from(guestRuntimeSession)
    .where(
      and(
        eq(guestRuntimeSession.id, id),
        eq(guestRuntimeSession.ownerId, ownerId)
      )
    );
  return guest ?? null;
};

export const readGuestRuntimeSession = async (
  sessionId: string
): Promise<typeof guestRuntimeSession.$inferSelect | null> => {
  const [guest] = await db
    .select()
    .from(guestRuntimeSession)
    .where(eq(guestRuntimeSession.sessionId, sessionId));
  return guest ?? null;
};

// Admission is charged before dispatch. Ambiguous network failures do not refund
// capacity: retrying cannot exceed the budget by claiming a send was lost.
export const reserveGuestRuntimeMessage = async (input: {
  sessionId: string;
  ownerId: string;
  requestsPerMinute: number;
  inputCharacters: number;
  maxInputCharacters: number;
}): Promise<"ready" | "unavailable" | "exhausted" | "rate-limited"> => {
  positiveLimit.parse(input.requestsPerMinute);
  positiveLimit.parse(input.inputCharacters);
  positiveLimit.parse(input.maxInputCharacters);
  return await db.transaction(async (tx) => {
    const [guest] = await tx
      .select()
      .from(guestRuntimeSession)
      .where(
        and(
          eq(guestRuntimeSession.sessionId, input.sessionId),
          eq(guestRuntimeSession.ownerId, input.ownerId),
          eq(guestRuntimeSession.state, "active"),
          sql`${guestRuntimeSession.credentialExpiresAt} > now()`,
          sql`${guestRuntimeSession.expiresAt} > now()`
        )
      )
      .for("update");
    if (typeof guest !== "object") {
      return "unavailable";
    }
    if (
      guest.messagesUsed >= guest.messageLimit ||
      guest.inputCharactersUsed + input.inputCharacters >
        input.maxInputCharacters
    ) {
      return "exhausted";
    }
    const bucket = await rateBucket(tx, guest.ipHash, "message");
    if (bucket.requests >= input.requestsPerMinute) {
      return "rate-limited";
    }
    await incrementRate(tx, bucket.key);
    await tx
      .update(guestRuntimeSession)
      .set({
        messagesUsed: sql`${guestRuntimeSession.messagesUsed} + 1`,
        inputCharactersUsed: sql`${guestRuntimeSession.inputCharactersUsed} + ${input.inputCharacters}`,
      })
      .where(eq(guestRuntimeSession.id, guest.id));
    return "ready";
  });
};

// A five-minute cooldown bounds repeated failures. Native purge has its own
// durable advisory lock and idempotent receipts, so overlapping cron retries are safe.
export const claimExpiredGuestRuntimeSession = async () =>
  await db.transaction(async (tx) => {
    const [guest] = await tx
      .select()
      .from(guestRuntimeSession)
      .where(
        and(
          inArray(guestRuntimeSession.state, ["active", "deleting"]),
          lte(guestRuntimeSession.expiresAt, sql`now()`),
          or(
            isNull(guestRuntimeSession.cleanupAttemptedAt),
            lte(
              guestRuntimeSession.cleanupAttemptedAt,
              sql`now() - interval '5 minutes'`
            )
          )
        )
      )
      .orderBy(
        sql`${guestRuntimeSession.cleanupAttemptedAt} asc nulls first`,
        guestRuntimeSession.createdAt
      )
      .limit(1)
      .for("update", { skipLocked: true });
    if (typeof guest !== "object") {
      return null;
    }
    await tx
      .update(guestRuntimeSession)
      .set({ state: "deleting", cleanupAttemptedAt: sql`now()` })
      .where(eq(guestRuntimeSession.id, guest.id));
    return { ...guest, state: "deleting" };
  });

export const completeGuestRuntimeDeletion = async (
  id: string,
  sessionId: string
): Promise<boolean> => {
  const rows = await db
    .update(guestRuntimeSession)
    .set({ state: "deleted", deletedAt: sql`now()` })
    .where(
      and(
        eq(guestRuntimeSession.id, id),
        eq(guestRuntimeSession.sessionId, sessionId),
        eq(guestRuntimeSession.state, "deleting")
      )
    )
    .returning({ id: guestRuntimeSession.id });
  return rows.length === 1;
};

export const pruneGuestRuntimeRates = async (): Promise<void> => {
  await db.execute(
    sql`delete from ${guestRuntimeRate} where ${guestRuntimeRate.startsAt} <= now() - interval '2 days'`
  );
};

// Only the cleanup worker may bind a replayed creation after public access expires.
export const bindGuestRuntimeCleanupSession = async (
  id: string,
  ownerId: string,
  sessionId: string
): Promise<boolean> => {
  z.string().min(1).parse(sessionId);
  const rows = await db
    .update(guestRuntimeSession)
    .set({ sessionId })
    .where(
      and(
        eq(guestRuntimeSession.id, id),
        eq(guestRuntimeSession.ownerId, ownerId),
        eq(guestRuntimeSession.state, "deleting"),
        or(
          isNull(guestRuntimeSession.sessionId),
          eq(guestRuntimeSession.sessionId, sessionId)
        )
      )
    )
    .returning({ id: guestRuntimeSession.id });
  return rows.length === 1;
};

/** Includes unclaimed expired guests and attempts hidden by cooldowns or another worker. */
export const countPendingGuestRuntimeDeletions = async (): Promise<number> => {
  const [row] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(guestRuntimeSession)
    .where(
      and(
        inArray(guestRuntimeSession.state, ["active", "deleting"]),
        lte(guestRuntimeSession.expiresAt, sql`now()`)
      )
    );
  if (typeof row !== "object") {
    throw new TypeError("Guest deletion inventory unavailable.");
  }
  return row.count;
};
