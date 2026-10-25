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

const INITIAL_USER_CREDIT_BALANCE_CENTS = 50;
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

const userCredit = pgTable("UserCredit", {
  /** Balance in cents. Default = $0.50 */
  credits: integer("credits")
    .notNull()
    .default(INITIAL_USER_CREDIT_BALANCE_CENTS),
  userId: text("userId")
    .primaryKey()
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

type UserCredit = InferSelectModel<typeof userCredit>;

const userModelPreference = pgTable(
  "UserModelPreference",
  {
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    enabled: boolean("enabled").notNull(),
    modelId: varchar("modelId", { length: 256 }).notNull(),
    updatedAt: timestamp("updatedAt")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (columns) => [
    index("UserModelPreference_user_id_idx").on(columns.userId),
    primaryKey({ columns: [columns.userId, columns.modelId] }),
  ]
);

type UserModelPreference = InferSelectModel<typeof userModelPreference>;

// Disposable runtime policy records never create an application account.
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
    messageLimit: integer("messageLimit").notNull(),
    messagesUsed: integer("messagesUsed").notNull().default(0),
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
      "GuestRuntimeSession_balance",
      sql`${columns.messagesUsed} >= 0 and ${columns.messagesUsed} <= ${columns.messageLimit}`
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

// Guest ownership is separate from BetterAuth sessions and monetary credits.
// Retain expired identities after content cleanup so late usage remains guest usage.
const eveGuest = pgTable(
  "EveGuest",
  {
    createdAt: timestamp("createdAt", { withTimezone: true })
      .defaultNow()
      .notNull(),
    expiresAt: timestamp("expiresAt", { withTimezone: true }).notNull(),
    messageLimit: integer("messageLimit").notNull(),
    ownerId: text("ownerId")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    remainingMessages: integer("remainingMessages").notNull(),
    tokenHash: varchar("tokenHash", { length: 64 }).notNull().unique(),
  },
  (columns) => [
    check(
      "EveGuest_message_balance",
      sql`${columns.remainingMessages} >= 0 and ${columns.remainingMessages} <= ${columns.messageLimit}`
    ),
    check("EveGuest_token_hash", sql`${columns.tokenHash} ~ '^[0-9a-f]{64}$'`),
    index("EveGuest_expiry_idx").on(columns.expiresAt),
  ]
);

const eveGuestRate = pgTable(
  "EveGuestRate",
  {
    ipHash: varchar("ipHash", { length: 64 }).notNull(),
    requests: integer("requests").notNull(),
    startsAt: timestamp("startsAt", { withTimezone: true }).notNull(),
    windowSeconds: integer("windowSeconds").notNull(),
  },
  (columns) => [
    primaryKey({
      columns: [columns.ipHash, columns.windowSeconds, columns.startsAt],
    }),
    check("EveGuestRate_requests", sql`${columns.requests} >= 0`),
    check(
      "EveGuestRate_window",
      sql`${columns.windowSeconds} in (60, 2592000)`
    ),
  ]
);

const eveGuestMessage = pgTable(
  "EveGuestMessage",
  {
    ipHash: varchar("ipHash", { length: 64 }).notNull(),
    operationId: uuid("operationId").notNull(),
    ownerId: text("ownerId")
      .notNull()
      .references(() => eveGuest.ownerId, { onDelete: "cascade" }),
    requestHash: varchar("requestHash", { length: 64 }).notNull(),
    reservationId: uuid("reservationId").notNull(),
    reservedAt: timestamp("reservedAt", { withTimezone: true }).notNull(),
    state: text("state")
      .$type<"reserved" | "committed" | "released">()
      .notNull(),
  },
  (columns) => [
    primaryKey({ columns: [columns.ownerId, columns.operationId] }),
    check(
      "EveGuestMessage_state",
      sql`${columns.state} in ('reserved', 'committed', 'released')`
    ),
    check(
      "EveGuestMessage_request_hash",
      sql`${columns.requestHash} ~ '^[0-9a-f]{64}$'`
    ),
  ]
);

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
    activeConversationId: uuid("activeConversationId"),
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
    guestCleanupAttemptedAt: timestamp("guestCleanupAttemptedAt", {
      withTimezone: true,
    }),
    id: uuid("id").primaryKey().defaultRandom(),
    initialContentHash: text("initialContentHash"),
    initialModelId: text("initialModelId"),
    initialRequest: jsonb("initialRequest").$type<unknown>(),
    initialSeed: jsonb("initialSeed").$type<unknown>(),
    operationId: uuid("operationId").notNull(),
    ownerId: text("ownerId")
      .notNull()
      .references(() => user.id),
    parentConversationId: uuid("parentConversationId"),
    rootConversationId: uuid("rootConversationId"),
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
    index("EveConversation_owner_root").on(
      table.ownerId,
      table.rootConversationId
    ),
    foreignKey({
      columns: [table.parentConversationId, table.ownerId, table.chatId],
      foreignColumns: [table.id, table.ownerId, table.chatId],
      name: "EveConversation_parent_owner_fk",
    }),
    foreignKey({
      columns: [table.rootConversationId, table.ownerId, table.chatId],
      foreignColumns: [table.id, table.ownerId, table.chatId],
      name: "EveConversation_root_owner_fk",
    }),
    check(
      "EveConversation_named_fork_shape",
      sql`${table.forkCheckpointId} is null or (
      ${table.parentConversationId} is not null and ${table.forkMessageId} is null
    )`
    ),
    check(
      "EveConversation_fork_shape",
      sql`(
      ${table.parentConversationId} is null and ${table.rootConversationId} is null and
      ${table.forkTurnId} is null and ${table.forkMessageId} is null and ${table.forkKind} is null
    ) or (
      ${table.parentConversationId} is not null and ${table.rootConversationId} is not null and
      (
        (${table.forkTurnId} is null and ${table.forkMessageId} is null) or
        (${table.forkTurnId} is not null and ${table.forkTurnId} ~ '^turn_(0|[1-9][0-9]*)$' and ${table.forkMessageId} is null) or
        (${table.forkMessageId} is not null and length(${table.forkMessageId}) between 1 and 512 and ${table.forkTurnId} is null)
      ) and
      ${table.parentConversationId} <> ${table.id} and ${table.rootConversationId} <> ${table.id}
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
    conversationId: uuid("conversationId").notNull(),
    kind: text("kind", { enum: ["create", "copy", "send"] }).notNull(),
    intent: jsonb("intent").$type<unknown>().notNull(),
    sessionId: text("sessionId"),
    deliveryId: text("deliveryId"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.ownerId, table.operationId] }),
    foreignKey({
      columns: [table.conversationId, table.ownerId],
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
    sourceConversationId: uuid("sourceConversationId"),
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

/** Feedback references native message IDs without copying the Eve transcript. */
const eveVote = pgTable(
  "EveVote",
  {
    conversationId: uuid("conversationId")
      .notNull()
      .references(() => eveConversation.id, { onDelete: "cascade" }),
    isUpvoted: boolean("isUpvoted").notNull(),
    messageId: text("messageId").notNull(),
  },
  (table) => [primaryKey({ columns: [table.conversationId, table.messageId] })]
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

/** Immutable uploaded originals retained by a workspace independently of transcript history. */
const eveWorkspaceAttachment = pgTable(
  "EveWorkspaceAttachment",
  {
    workspaceId: uuid("workspaceId").notNull(),
    fileKey: text("fileKey").notNull(),
    ownerId: text("ownerId").notNull(),
    sha256: text("sha256").notNull(),
    paths: text("paths")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceId, table.fileKey] }),
    index("EveWorkspaceAttachment_file").on(table.fileKey),
    foreignKey({
      columns: [table.workspaceId, table.ownerId],
      foreignColumns: [eveWorkspace.id, eveWorkspace.ownerId],
      name: "EveWorkspaceAttachment_workspace_owner_fk",
    }),
    foreignKey({
      columns: [table.fileKey, table.ownerId],
      foreignColumns: [eveStoredFile.key, eveStoredFile.ownerId],
      name: "EveWorkspaceAttachment_file_owner_fk",
    }),
  ]
);

const eveFileReference = pgTable(
  "EveFileReference",
  {
    conversationId: uuid("conversationId").notNull(),
    key: text("key").notNull(),
    ownerId: text("ownerId").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.conversationId, table.key] }),
    index("EveFileReference_key").on(table.key),
    foreignKey({
      columns: [table.conversationId, table.ownerId],
      foreignColumns: [eveConversation.id, eveConversation.ownerId],
    }),
    foreignKey({
      columns: [table.key, table.ownerId],
      foreignColumns: [eveStoredFile.key, eveStoredFile.ownerId],
    }),
  ]
);

// Allocation intent survives provider timeouts and worker crashes.
// Persistent filesystem ownership is retained independently of native workflow payloads.
const eveSandboxSession = pgTable(
  "EveSandboxSession",
  {
    sessionId: text("sessionId").primaryKey(),
    rootSessionId: text("rootSessionId").notNull(),
    conversationId: uuid("conversationId").notNull(),
    workspaceId: uuid("workspaceId").notNull(),
    ownerId: text("ownerId").notNull(),
    devRunId: text("devRunId"),
    state: text("state", { enum: ["active", "retired"] }).notNull(),
  },
  (table) => [
    index("EveSandboxSession_root").on(table.rootSessionId),
    index("EveSandboxSession_workspace").on(table.workspaceId),
    foreignKey({
      columns: [table.conversationId, table.ownerId],
      foreignColumns: [eveConversation.id, eveConversation.ownerId],
      name: "EveSandboxSession_conversation_owner_fk",
    }),
    foreignKey({
      columns: [table.workspaceId, table.ownerId],
      foreignColumns: [eveWorkspace.id, eveWorkspace.ownerId],
      name: "EveSandboxSession_workspace_owner_fk",
    }),
    index("EveSandboxSession_dev").on(table.devRunId),
  ]
);
const evePersistentSandbox = pgTable(
  "EvePersistentSandbox",
  {
    name: text("name").primaryKey(),
    workspaceId: uuid("workspaceId")
      .notNull()
      .references(() => eveWorkspace.id),
    providerId: text("providerId").notNull(),
    accountId: text("accountId").notNull(),
    scopeId: text("scopeId").notNull(),
    state: text("state", { enum: ["pending", "ready", "deleted"] }).notNull(),
  },
  (table) => [unique("EvePersistentSandbox_workspace").on(table.workspaceId)]
);

const eveCodeSandbox = pgTable(
  "EveCodeSandbox",
  {
    callId: text("callId").notNull(),
    conversationId: uuid("conversationId").notNull(),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    creationConfirmed: boolean("creationConfirmed").notNull().default(false),
    name: text("name").primaryKey(),
    ownerId: text("ownerId").notNull(),
    state: text("state", { enum: ["unresolved", "deleted"] })
      .notNull()
      .default("unresolved"),
  },
  (table) => [
    foreignKey({
      columns: [table.conversationId, table.ownerId],
      foreignColumns: [eveConversation.id, eveConversation.ownerId],
    }),
    index("EveCodeSandbox_conversation").on(table.conversationId),
  ]
);

/** Native child identity and billing progress; transcript stays in EVE. */
const eveSubagentSession = pgTable(
  "EveSubagentSession",
  {
    conversationId: uuid("conversationId").notNull(),
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
      columns: [table.conversationId, table.ownerId],
      foreignColumns: [eveConversation.id, eveConversation.ownerId],
      name: "EveSubagentSession_conversation_owner_fk",
    }).onDelete("cascade"),
    index("EveSubagentSession_conversation").on(table.conversationId),
    check(
      "EveSubagentSession_not_self",
      sql`${table.sessionId} <> ${table.parentSessionId}`
    ),
    check("EveSubagentSession_cursor", sql`${table.usageStreamIndex} >= 0`),
  ]
);

/** Optional display output, shared by native branches of the same chat. */
const eveFollowup = pgTable(
  "EveFollowup",
  {
    chatId: uuid("chatId").notNull(),
    ownerId: text("ownerId").notNull(),
    turnId: text("turnId").notNull(),
    sessionId: text("sessionId").notNull(),
    eventId: text("eventId").primaryKey(),
    suggestions: jsonb("suggestions").$type<readonly string[]>(),
  },
  (table) => [
    index("EveFollowup_chat").on(table.chatId),
    unique().on(table.sessionId, table.turnId),
    foreignKey({
      columns: [table.chatId, table.ownerId],
      foreignColumns: [eveChat.id, eveChat.ownerId],
    }).onDelete("cascade"),
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

const eveDocumentRevision = pgTable(
  "EveDocumentRevision",
  {
    content: text("content").notNull(),
    conversationId: uuid("conversationId").notNull(),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    documentId: uuid("documentId").notNull(),
    fileIds: jsonb("fileIds").$type<readonly string[]>().notNull().default([]),
    id: uuid("id").primaryKey().defaultRandom(),
    kind: varchar("kind", { enum: ["text", "code", "sheet"] }).notNull(),
    operationId: text("operationId").notNull(),
    ownerId: text("ownerId").notNull(),
    parentRevisionId: uuid("parentRevisionId"),
    title: text("title").notNull(),
    turnIndex: integer("turnIndex"),
  },
  (table) => [
    uniqueIndex("EveDocumentRevision_operation").on(
      table.conversationId,
      table.operationId
    ),
    unique("EveDocumentRevision_identity").on(
      table.id,
      table.documentId,
      table.ownerId
    ),
    foreignKey({
      columns: [table.conversationId, table.ownerId],
      foreignColumns: [eveConversation.id, eveConversation.ownerId],
      name: "EveDocumentRevision_conversation_owner_fk",
    }),
    foreignKey({
      columns: [table.parentRevisionId, table.documentId, table.ownerId],
      foreignColumns: [table.id, table.documentId, table.ownerId],
      name: "EveDocumentRevision_parent_document_owner_fk",
    }),
    check("EveDocumentRevision_turn_nonnegative", sql`${table.turnIndex} >= 0`),
  ]
);

const eveDocumentHead = pgTable(
  "EveDocumentHead",
  {
    conversationId: uuid("conversationId").notNull(),
    documentId: uuid("documentId").notNull(),
    ownerId: text("ownerId").notNull(),
    revisionId: uuid("revisionId").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.conversationId, table.documentId] }),
    foreignKey({
      columns: [table.conversationId, table.ownerId],
      foreignColumns: [eveConversation.id, eveConversation.ownerId],
      name: "EveDocumentHead_conversation_owner_fk",
    }),
    foreignKey({
      columns: [table.revisionId, table.documentId, table.ownerId],
      foreignColumns: [
        eveDocumentRevision.id,
        eveDocumentRevision.documentId,
        eveDocumentRevision.ownerId,
      ],
      name: "EveDocumentHead_revision_document_owner_fk",
    }),
  ]
);

type EveDocumentRevision = InferSelectModel<typeof eveDocumentRevision>;

const eveDocumentCheckpoint = pgTable(
  "EveDocumentCheckpoint",
  {
    conversationId: uuid("conversationId").notNull(),
    ownerId: text("ownerId").notNull(),
    turnIndex: integer("turnIndex").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.conversationId, table.turnIndex] }),
    unique("EveDocumentCheckpoint_owner_identity").on(
      table.conversationId,
      table.turnIndex,
      table.ownerId
    ),
    foreignKey({
      columns: [table.conversationId, table.ownerId],
      foreignColumns: [eveConversation.id, eveConversation.ownerId],
      name: "EveDocumentCheckpoint_conversation_owner_fk",
    }),
    check(
      "EveDocumentCheckpoint_turn_nonnegative",
      sql`${table.turnIndex} >= 0`
    ),
  ]
);

const eveDocumentCheckpointEntry = pgTable(
  "EveDocumentCheckpointEntry",
  {
    conversationId: uuid("conversationId").notNull(),
    documentId: uuid("documentId").notNull(),
    ownerId: text("ownerId").notNull(),
    revisionId: uuid("revisionId").notNull(),
    turnIndex: integer("turnIndex").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.conversationId, table.turnIndex, table.documentId],
    }),
    foreignKey({
      columns: [table.conversationId, table.turnIndex, table.ownerId],
      foreignColumns: [
        eveDocumentCheckpoint.conversationId,
        eveDocumentCheckpoint.turnIndex,
        eveDocumentCheckpoint.ownerId,
      ],
      name: "EveDocumentCheckpointEntry_checkpoint_owner_fk",
    }),
    foreignKey({
      columns: [table.revisionId, table.documentId, table.ownerId],
      foreignColumns: [
        eveDocumentRevision.id,
        eveDocumentRevision.documentId,
        eveDocumentRevision.ownerId,
      ],
      name: "EveDocumentCheckpointEntry_revision_owner_fk",
    }),
  ]
);

/** Immutable document boundary captured by a serialized native idle command. */
const eveNamedDocumentCheckpoint = pgTable(
  "EveNamedDocumentCheckpoint",
  {
    checkpointId: uuid("checkpointId").notNull(),
    conversationId: uuid("conversationId").notNull(),
    ownerId: text("ownerId").notNull(),
    turnIndex: integer("turnIndex").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.conversationId, table.checkpointId] }),
    unique("EveNamedDocumentCheckpoint_owner_identity").on(
      table.conversationId,
      table.checkpointId,
      table.ownerId
    ),
    foreignKey({
      columns: [table.conversationId, table.ownerId],
      foreignColumns: [eveConversation.id, eveConversation.ownerId],
      name: "EveNamedDocumentCheckpoint_conversation_owner_fk",
    }),
    check(
      "EveNamedDocumentCheckpoint_turn_nonnegative",
      sql`${table.turnIndex} >= 0`
    ),
  ]
);

const eveNamedDocumentCheckpointEntry = pgTable(
  "EveNamedDocumentCheckpointEntry",
  {
    checkpointId: uuid("checkpointId").notNull(),
    conversationId: uuid("conversationId").notNull(),
    documentId: uuid("documentId").notNull(),
    ownerId: text("ownerId").notNull(),
    revisionId: uuid("revisionId").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.conversationId, table.checkpointId, table.documentId],
    }),
    foreignKey({
      columns: [table.conversationId, table.checkpointId, table.ownerId],
      foreignColumns: [
        eveNamedDocumentCheckpoint.conversationId,
        eveNamedDocumentCheckpoint.checkpointId,
        eveNamedDocumentCheckpoint.ownerId,
      ],
      name: "EveNamedDocumentCheckpointEntry_checkpoint_owner_fk",
    }),
    foreignKey({
      columns: [table.revisionId, table.documentId, table.ownerId],
      foreignColumns: [
        eveDocumentRevision.id,
        eveDocumentRevision.documentId,
        eveDocumentRevision.ownerId,
      ],
      name: "EveNamedDocumentCheckpointEntry_revision_owner_fk",
    }),
  ]
);

/** Document heads at an imported transcript message boundary. */
const eveImportedDocumentCheckpoint = pgTable(
  "EveImportedDocumentCheckpoint",
  {
    conversationId: uuid("conversationId").notNull(),
    messageIndex: integer("messageIndex").notNull(),
    ownerId: text("ownerId").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.conversationId, table.messageIndex] }),
    unique("EveImportedDocumentCheckpoint_owner_identity").on(
      table.conversationId,
      table.messageIndex,
      table.ownerId
    ),
    foreignKey({
      columns: [table.conversationId, table.ownerId],
      foreignColumns: [eveConversation.id, eveConversation.ownerId],
      name: "EveImportedDocumentCheckpoint_conversation_owner_fk",
    }),
    check(
      "EveImportedDocumentCheckpoint_message_range",
      sql`${table.messageIndex} between 0 and 9999`
    ),
  ]
);

const eveImportedDocumentCheckpointEntry = pgTable(
  "EveImportedDocumentCheckpointEntry",
  {
    conversationId: uuid("conversationId").notNull(),
    documentId: uuid("documentId").notNull(),
    messageIndex: integer("messageIndex").notNull(),
    ownerId: text("ownerId").notNull(),
    revisionId: uuid("revisionId").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.conversationId, table.messageIndex, table.documentId],
    }),
    foreignKey({
      columns: [table.conversationId, table.messageIndex, table.ownerId],
      foreignColumns: [
        eveImportedDocumentCheckpoint.conversationId,
        eveImportedDocumentCheckpoint.messageIndex,
        eveImportedDocumentCheckpoint.ownerId,
      ],
      name: "EveImportedDocumentCheckpointEntry_checkpoint_owner_fk",
    }),
    foreignKey({
      columns: [table.revisionId, table.documentId, table.ownerId],
      foreignColumns: [
        eveDocumentRevision.id,
        eveDocumentRevision.documentId,
        eveDocumentRevision.ownerId,
      ],
      name: "EveImportedDocumentCheckpointEntry_revision_owner_fk",
    }),
  ]
);

/** Rebuildable display-text projection; EVE remains the transcript source of truth. */
const eveSearchText = pgTable(
  "EveSearchText",
  {
    conversationId: uuid("conversationId").notNull(),
    key: text("key").notNull(),
    ownerId: text("ownerId").notNull(),
    text: text("text").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.conversationId, table.key] }),
    foreignKey({
      columns: [table.conversationId, table.ownerId],
      foreignColumns: [eveConversation.id, eveConversation.ownerId],
    }).onDelete("cascade"),
    index("EveSearchText_owner").on(table.ownerId),
    index("EveSearchText_content").using(
      "gin",
      sql`to_tsvector('simple', ${table.text})`
    ),
  ]
);

export {
  eveWorkspace,
  eveSandboxSession,
  evePersistentSandbox,
  eveDispatch,
  account,
  eveChat,
  eveCodeSandbox,
  eveConversation,
  eveDocumentCheckpoint,
  eveDocumentCheckpointEntry,
  eveDocumentHead,
  eveDocumentRevision,
  eveFileReference,
  eveWorkspaceAttachment,
  eveFollowup,
  eveGuest,
  guestRuntimeSession,
  guestRuntimeRate,
  eveGuestMessage,
  eveGuestRate,
  eveImportedDocumentCheckpoint,
  eveImportedDocumentCheckpointEntry,
  eveNamedDocumentCheckpoint,
  eveNamedDocumentCheckpointEntry,
  eveResponseGroup,
  eveSearchText,
  eveStoredFile,
  eveSubagentSession,
  eveUsage,
  eveVote,
  eveWorkflowBackend,
  schema,
  session,
  user,
  userCredit,
  userModelPreference,
  verification,
};
export type {
  EveChat,
  EveDocumentRevision,
  User,
  UserCredit,
  UserModelPreference,
};
