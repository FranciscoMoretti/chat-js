import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  check,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";

const guestRuntimeSession = pgTable(
  "GuestRuntimeSession",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("ownerId").notNull().unique(),
    sessionId: text("sessionId").unique(),
    modelId: text("modelId").notNull(),
    ipHash: text("ipHash").notNull(),
    policyVersion: integer("policyVersion").notNull().default(1),
    state: text("state").notNull().default("active"),
    createdAt: timestamp("createdAt", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expiresAt", { withTimezone: true })
      .notNull()
      .default(sql`now() + interval '24 hours'`),
    credentialExpiresAt: timestamp("credentialExpiresAt", {
      withTimezone: true,
    }).notNull(),
    inputCharactersUsed: integer("inputCharactersUsed").notNull().default(0),
    cleanupAttemptedAt: timestamp("cleanupAttemptedAt", { withTimezone: true }),
    deletedAt: timestamp("deletedAt", { withTimezone: true }),
  },
  (columns) => [
    check(
      "GuestRuntimeSession_state",
      sql`${columns.state} in ('active', 'deleting', 'deleted')`
    ),
    check(
      "GuestRuntimeSession_ip_hash",
      sql`${columns.ipHash} ~ '^[0-9a-f]{64}$'`
    ),
    check(
      "GuestRuntimeSession_expiry",
      sql`${columns.expiresAt} = ${columns.createdAt} + interval '24 hours'`
    ),
    index("GuestRuntimeSession_cleanup_idx").on(
      columns.state,
      columns.expiresAt
    ),
  ]
);

const guestRuntimeRate = pgTable(
  "GuestRuntimeRate",
  {
    ipHash: text("ipHash").notNull(),
    kind: text("kind").notNull(),
    startsAt: timestamp("startsAt", { withTimezone: true }).notNull(),
    requests: integer("requests").notNull().default(0),
  },
  (columns) => [
    primaryKey({ columns: [columns.ipHash, columns.kind, columns.startsAt] }),
    check("GuestRuntimeRate_requests", sql`${columns.requests} >= 0`),
    check(
      "GuestRuntimeRate_kind",
      sql`${columns.kind} in ('session', 'message')`
    ),
  ]
);

export { guestRuntimeSession, guestRuntimeRate };
