import type { InferSelectModel } from "drizzle-orm";
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

const INITIAL_USAGE_STREAM_INDEX = 0;
const NO_USAGE_CHARGE_CENTS = 0;
const WORKFLOW_BACKEND_SINGLETON_ID = 1;

/** One application database belongs to one durable workflow world. */
const eveWorkflowBackend = pgTable(
  "EveWorkflowBackend",
  {
    id: integer("id").primaryKey().default(WORKFLOW_BACKEND_SINGLETON_ID),
    world: text("world").notNull(),
  },
  (table: { readonly id: unknown }) => [
    check("EveWorkflowBackend_singleton", sql`${table.id} = 1`),
  ]
);

const user = pgTable("user", {
  createdAt: timestamp("created_at").defaultNow().notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  eveUsageReconciledAt: timestamp("eve_usage_reconciled_at"),
  id: text("id").primaryKey(),
  image: text("image"),
  name: text("name").notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(
      () =>
        /* @__PURE__ */
        new Date()
    )
    .notNull(),
});

type User = InferSelectModel<typeof user>;

// Disposable runtime policy records never create an application account.

const session = pgTable("session", {
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  id: text("id").primaryKey(),
  ipAddress: text("ip_address"),
  token: text("token").notNull().unique(),
  updatedAt: timestamp("updated_at")
    .$onUpdate(
      () =>
        /* @__PURE__ */
        new Date()
    )
    .notNull(),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

const account = pgTable("account", {
  accessToken: text("access_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  accountId: text("account_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  id: text("id").primaryKey(),
  idToken: text("id_token"),
  password: text("password"),
  providerId: text("provider_id").notNull(),
  refreshToken: text("refresh_token"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  updatedAt: timestamp("updated_at")
    .$onUpdate(
      () =>
        /* @__PURE__ */
        new Date()
    )
    .notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

const verification = pgTable("verification", {
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(
      () =>
        /* @__PURE__ */
        new Date()
    )
    .notNull(),
  value: text("value").notNull(),
});

const schema = { account, session, user, verification };

// Mutable filesystem ownership is independent of any conversation or native session.
const eveWorkspace = pgTable(
  "EveWorkspace",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("ownerId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    state: text("state", { enum: ["active", "deleting", "deleted"] })
      .notNull()
      .default("active"),
    activeOperationId: uuid("activeOperationId"),
  },
  (table) => [unique("EveWorkspace_id_owner").on(table.id, table.ownerId)]
);

// Metadata only. Eve owns the transcript and execution state.
const eveChat = pgTable(
  "EveChat",
  {
    activeBranchId: uuid("activeBranchId"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    id: uuid("id").primaryKey().defaultRandom(),
    isPinned: boolean("isPinned").notNull().default(false),
    ownerId: text("ownerId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    titleStatus: text("titleStatus", {
      enum: ["pending", "fallback", "generated", "manual"],
    })
      .notNull()
      .default("pending"),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (table) => [
    unique("EveChat_id_owner").on(table.id, table.ownerId),
    index("EveChat_search_title").using(
      "gin",
      sql`to_tsvector('simple', ${table.title})`
    ),
    index("EveChat_owner_activity").on(
      table.ownerId,
      table.isPinned,
      table.updatedAt
    ),
    check(
      "EveChat_title_status",
      sql`${table.titleStatus} in ('pending', 'fallback', 'generated', 'manual')`
    ),
  ]
);

type EveChat = InferSelectModel<typeof eveChat>;

// One logical chat may contain several private native EVE sessions.
const eveConversation = pgTable(
  "EveConversation",
  {
    chatId: uuid("chatId").notNull(),
    workspaceId: uuid("workspaceId").notNull(),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    creationKind: text("creationKind", { enum: ["message", "copy"] })
      .notNull()
      .default("message"),
    firstMessage: text("firstMessage").notNull(),
    forkCheckpointId: uuid("forkCheckpointId"),
    forkKind: text("forkKind", {
      enum: ["edit", "regenerate", "comparison"],
    }),
    forkMessageId: text("forkMessageId"),
    forkTurnId: text("forkTurnId"),
    id: uuid("id").primaryKey().defaultRandom(),
    initialContentHash: text("initialContentHash"),
    initialModelId: text("initialModelId"),
    initialRequest: jsonb("initialRequest").$type<unknown>(),
    initialSeed: jsonb("initialSeed").$type<unknown>(),
    operationId: uuid("operationId").notNull(),
    ownerId: text("ownerId")
      .notNull()
      .references(() => user.id),
    parentBranchId: uuid("parentBranchId"),
    rootBranchId: uuid("rootBranchId"),
    sessionId: text("sessionId").unique(),
    state: text("state", {
      enum: ["creating", "bound", "uncertain", "deleting", "deleted"],
    })
      .notNull()
      .default("creating"),
    usageStreamIndex: integer("usageStreamIndex")
      .notNull()
      .default(INITIAL_USAGE_STREAM_INDEX),
    visibility: varchar("visibility", { enum: ["private", "public"] })
      .notNull()
      .default("private"),
  },
  (table) => [
    check(
      "EveConversation_creation_kind",
      sql`${table.creationKind} in ('message', 'copy')`
    ),
    unique("EveConversation_id_owner").on(table.id, table.ownerId),
    unique("EveConversation_id_owner_chat").on(
      table.id,
      table.ownerId,
      table.chatId
    ),
    index("EveConversation_owner_chat").on(table.ownerId, table.chatId),
    index("EveConversation_workspace").on(table.workspaceId),
    foreignKey({
      columns: [table.workspaceId, table.ownerId],
      foreignColumns: [eveWorkspace.id, eveWorkspace.ownerId],
      name: "EveConversation_workspace_owner_fk",
    }),
    foreignKey({
      columns: [table.chatId, table.ownerId],
      foreignColumns: [eveChat.id, eveChat.ownerId],
      name: "EveConversation_chat_owner_fk",
    }),
    index("EveConversation_owner_root").on(table.ownerId, table.rootBranchId),
    foreignKey({
      columns: [table.parentBranchId, table.ownerId, table.chatId],
      foreignColumns: [table.id, table.ownerId, table.chatId],
      name: "EveConversation_parent_owner_fk",
    }),
    foreignKey({
      columns: [table.rootBranchId, table.ownerId, table.chatId],
      foreignColumns: [table.id, table.ownerId, table.chatId],
      name: "EveConversation_root_owner_fk",
    }),
    check(
      "EveConversation_named_fork_shape",
      sql`${table.forkCheckpointId} is null or (
      ${table.parentBranchId} is not null and ${table.forkMessageId} is null
    )`
    ),
    check(
      "EveConversation_fork_shape",
      sql`(
      ${table.parentBranchId} is null and ${table.rootBranchId} is null and
      ${table.forkTurnId} is null and ${table.forkMessageId} is null and ${table.forkKind} is null
    ) or (
      ${table.parentBranchId} is not null and ${table.rootBranchId} is not null and
      (
        (${table.forkTurnId} is null and ${table.forkMessageId} is null) or
        (${table.forkTurnId} is not null and ${table.forkTurnId} ~ '^turn_(0|[1-9][0-9]*)$' and ${table.forkMessageId} is null) or
        (${table.forkMessageId} is not null and length(${table.forkMessageId}) between 1 and 512 and ${table.forkTurnId} is null)
      ) and
      ${table.parentBranchId} <> ${table.id} and ${table.rootBranchId} <> ${table.id}
    )`
    ),
    check(
      "EveConversation_fork_kind",
      sql`${table.forkKind} is null or ${table.forkKind} in ('edit', 'regenerate', 'comparison')`
    ),
    uniqueIndex("EveConversation_owner_operation").on(
      table.ownerId,
      table.operationId
    ),
  ]
);

/** Temporary copy preparation is discarded once native history is bound. */
const eveDispatch = pgTable(
  "EveDispatch",
  {
    ownerId: text("ownerId")
      .notNull()
      .references(() => user.id),
    operationId: uuid("operationId").notNull(),
    branchId: uuid("branchId").notNull(),
    kind: text("kind", { enum: ["create", "copy", "send"] }).notNull(),
    intent: jsonb("intent").$type<unknown>().notNull(),
    sessionId: text("sessionId"),
    deliveryId: text("deliveryId"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.ownerId, table.operationId] }),
    foreignKey({
      columns: [table.branchId, table.ownerId],
      foreignColumns: [eveConversation.id, eveConversation.ownerId],
      name: "EveDispatch_conversation_owner_fk",
    }),
    check("EveDispatch_kind", sql`${table.kind} in ('create', 'copy', 'send')`),
    check(
      "EveDispatch_binding",
      sql`${table.deliveryId} is null or ${table.sessionId} is not null`
    ),
  ]
);

/** Immutable fan-out intent. Native sessions remain the only transcript store. */
const eveResponseGroup = pgTable(
  "EveResponseGroup",
  {
    candidateOperationIds: uuid("candidateOperationIds").array().notNull(),
    candidates: jsonb("candidates").$type<
      {
        modelId: string;
        operationId: string;
        rejection?: { error: string; code?: string };
      }[]
    >(),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    deleted: boolean("deleted").notNull().default(false),
    id: uuid("id").primaryKey().defaultRandom(),
    inputHash: text("inputHash"),
    operationId: uuid("operationId").notNull(),
    ownerId: text("ownerId")
      .notNull()
      .references(() => user.id),
    sourceBranchId: uuid("sourceBranchId"),
    sourceIdentityKnown: boolean("sourceIdentityKnown")
      .notNull()
      .default(false),
  },
  (table) => [
    uniqueIndex("EveResponseGroup_owner_operation").on(
      table.ownerId,
      table.operationId
    ),
  ]
);

/** Application-owned storage identity; transcript contents remain in EVE. */
const eveStoredFile = pgTable(
  "EveStoredFile",
  {
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    /** Stable public file ID, independent of the storage object pathname. */
    key: text("key").primaryKey(),
    ownerId: text("ownerId")
      .notNull()
      .references(() => user.id),
    state: text("state", { enum: ["active", "deleting", "deleted"] })
      .notNull()
      .default("active"),
    storageKey: text("storageKey")
      .notNull()
      .default(sql`gen_random_uuid()::text`)
      .unique(),
  },
  (table) => [
    index("EveStoredFile_owner").on(table.ownerId),
    unique("EveStoredFile_key_owner").on(table.key, table.ownerId),
  ]
);

const eveFileReference = pgTable(
  "EveFileReference",
  {
    branchId: uuid("branchId").notNull(),
    key: text("key").notNull(),
    ownerId: text("ownerId").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.branchId, table.key] }),
    index("EveFileReference_key").on(table.key),
    foreignKey({
      columns: [table.branchId, table.ownerId],
      foreignColumns: [eveConversation.id, eveConversation.ownerId],
    }),
    foreignKey({
      columns: [table.key, table.ownerId],
      foreignColumns: [eveStoredFile.key, eveStoredFile.ownerId],
    }),
  ]
);

/** Native child identity and billing progress; transcript stays in EVE. */
const eveSubagentSession = pgTable(
  "EveSubagentSession",
  {
    branchId: uuid("branchId").notNull(),
    ownerId: text("ownerId").notNull(),
    parentSessionId: text("parentSessionId").notNull(),
    rootTurnId: text("rootTurnId").notNull(),
    sessionId: text("sessionId").primaryKey(),
    usageStreamIndex: integer("usageStreamIndex")
      .notNull()
      .default(INITIAL_USAGE_STREAM_INDEX),
  },
  (table) => [
    foreignKey({
      columns: [table.branchId, table.ownerId],
      foreignColumns: [eveConversation.id, eveConversation.ownerId],
      name: "EveSubagentSession_conversation_owner_fk",
    }).onDelete("cascade"),
    index("EveSubagentSession_conversation").on(table.branchId),
    check(
      "EveSubagentSession_not_self",
      sql`${table.sessionId} <> ${table.parentSessionId}`
    ),
    check("EveSubagentSession_cursor", sql`${table.usageStreamIndex} >= 0`),
  ]
);

const eveUsage = pgTable(
  "EveUsage",
  {
    chargedCents: integer("chargedCents")
      .notNull()
      .default(NO_USAGE_CHARGE_CENTS),
    costUsd: numeric("costUsd", { precision: 24, scale: 12 }),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    eventId: text("eventId").primaryKey(),
    generationId: text("generationId"),
    modelAttempt: jsonb("modelAttempt").$type<unknown>(),
    ownerId: text("ownerId")
      .notNull()
      .references(() => user.id),
    sessionId: text("sessionId").notNull(),
    turnId: text("turnId").notNull(),
  },
  (table) => [
    index("EveUsage_session_turn").on(table.sessionId, table.turnId),
    index("EveUsage_unpriced_owner")
      .on(table.ownerId)
      .where(sql`${table.costUsd} is null`),
  ]
);

export {
  eveWorkspace,
  eveDispatch,
  account,
  eveChat,
  eveConversation,
  eveFileReference,
  eveResponseGroup,
  eveStoredFile,
  eveSubagentSession,
  eveUsage,
  eveWorkflowBackend,
  schema,
  session,
  user,
  verification,
};
export type { EveChat, User };
