import type { InferSelectModel } from "drizzle-orm";
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  json,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import type { EveCopyPlan, EveCopySeed } from "../eve/copy-journal-contract";
import { encryptedJson, encryptedText } from "./encrypted-text";

export const user = pgTable("user", {
  createdAt: timestamp("created_at").defaultNow().notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
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

export type User = InferSelectModel<typeof user>;

export const userCredit = pgTable("UserCredit", {
  /** Balance in cents. Default = $0.50 */
  credits: integer("credits").notNull().default(50),
  userId: text("userId")
    .primaryKey()
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export type UserCredit = InferSelectModel<typeof userCredit>;

export const userModelPreference = pgTable(
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
  (t) => ({
    UserModelPreference_user_id_idx: index(
      "UserModelPreference_user_id_idx"
    ).on(t.userId),
    pk: primaryKey({ columns: [t.userId, t.modelId] }),
  })
);

export type UserModelPreference = InferSelectModel<typeof userModelPreference>;

export const project = pgTable(
  "Project",
  {
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    icon: varchar("icon", { length: 64 }).notNull().default("folder"),
    iconColor: varchar("iconColor", { length: 32 }).notNull().default("gray"),
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    instructions: text("instructions").notNull().default(""),
    name: text("name").notNull(),
    updatedAt: timestamp("updatedAt")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => ({
    Project_id_user_idx: uniqueIndex("Project_id_user_idx").on(t.id, t.userId),
    Project_user_id_idx: index("Project_user_id_idx").on(t.userId),
  })
);

export type Project = InferSelectModel<typeof project>;

export const chat = pgTable("Chat", {
  createdAt: timestamp("createdAt").notNull(),
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  isPinned: boolean("isPinned").notNull().default(false),
  projectId: uuid("projectId").references(() => project.id, {
    onDelete: "set null",
  }),
  title: text("title").notNull(),
  updatedAt: timestamp("updatedAt")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  userId: text("userId")
    .notNull()
    .references(() => user.id),
  visibility: varchar("visibility", { enum: ["public", "private"] })
    .notNull()
    .default("private"),
});

export type Chat = InferSelectModel<typeof chat>;

export const message = pgTable("Message", {
  activeStreamId: varchar("activeStreamId", { length: 64 }),
  annotations: json("annotations"),
  // parts column removed - parts are now stored in Part table
  attachments: json("attachments").notNull(),
  /** Timestamp when this message's stream was canceled by the user. Null means not canceled. */
  canceledAt: timestamp("canceledAt"),
  chatId: uuid("chatId")
    .notNull()
    .references(() => chat.id, {
      onDelete: "cascade",
    }),
  createdAt: timestamp("createdAt").notNull(),
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  isPrimaryParallel: boolean("isPrimaryParallel"),
  lastContext: json("lastContext"),
  parallelGroupId: uuid("parallelGroupId"),
  parallelIndex: integer("parallelIndex"),
  parentMessageId: uuid("parentMessageId"),
  role: varchar("role").notNull(),
  selectedModel: json("selectedModel"),
  selectedTool: varchar("selectedTool", { length: 256 }).default(""),
});

export type DBMessage = InferSelectModel<typeof message>;

/**
 * Prefix-based Part Storage
 *
 * This table replaces the JSON `Message.parts` column with a normalized,
 * prefix-based column structure. Each row represents a single message part.
 *
 * Rationale:
 * - Type safety: Strongly-typed columns instead of flexible JSONB
 * - Data integrity: Database-level check constraints ensure valid part data
 * - Query performance: Direct column access with proper indexes
 * - Migration-friendly: Schema changes can be applied incrementally
 * - Extensibility: New part types can be added via new columns with prefixes
 *
 * Prefix Convention:
 * - text_*: Text content parts
 * - reasoning_*: Reasoning/thinking parts
 * - file_*: File attachments
 * - source_url_*: URL sources
 * - source_document_*: Document sources
 * - tool_*: Tool calls (generic for all tool-[name] parts)
 * - data_*: Custom data parts (generic bucket for all data-[type] parts)
 *
 */
export const part = pgTable(
  "Part",
  {
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    data_blob: json("data_blob"),
    // Data fields (generic bucket for all data-* parts)
    data_type: varchar("data_type"),
    file_filename: varchar("file_filename"),
    // File fields
    file_mediaType: varchar("file_mediaType"),
    file_url: varchar("file_url"),
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    messageId: uuid("messageId")
      .notNull()
      .references(() => message.id, { onDelete: "cascade" }),
    order: integer("order").notNull().default(0),
    // Provider metadata
    providerMetadata: json("providerMetadata"),
    // Reasoning fields
    reasoning_text: text("reasoning_text"),
    source_document_filename: varchar("source_document_filename"),
    source_document_mediaType: varchar("source_document_mediaType"),
    // Source Document fields
    source_document_sourceId: varchar("source_document_sourceId"),
    source_document_title: varchar("source_document_title"),
    // Source URL fields
    source_url_sourceId: varchar("source_url_sourceId"),
    source_url_title: varchar("source_url_title"),
    source_url_url: varchar("source_url_url"),
    // Text fields
    text_text: text("text_text"),
    tool_errorText: varchar("tool_errorText"),
    tool_input: json("tool_input"),
    // Tool fields (generic for all tool-* parts)
    tool_name: varchar("tool_name"),
    tool_output: json("tool_output"),
    tool_state: varchar("tool_state"),
    tool_toolCallId: varchar("tool_toolCallId"),
    type: varchar("type").notNull(),
  },
  (t) => ({
    Part_message_id_idx: index("Part_message_id_idx").on(t.messageId),
    Part_message_id_order_idx: index("Part_message_id_order_idx").on(
      t.messageId,
      t.order
    ),
    data_chk: check(
      "Part_data_required_if_type_data",
      sql`CASE WHEN ${t.type} LIKE 'data-%' THEN ${t.data_type} IS NOT NULL ELSE TRUE END`
    ),
    file_chk: check(
      "Part_file_required_if_type_file",
      sql`CASE WHEN ${t.type} = 'file' THEN ${t.file_mediaType} IS NOT NULL AND ${t.file_url} IS NOT NULL ELSE TRUE END`
    ),
    reasoning_chk: check(
      "Part_reasoning_required_if_type_reasoning",
      sql`CASE WHEN ${t.type} = 'reasoning' THEN ${t.reasoning_text} IS NOT NULL ELSE TRUE END`
    ),
    source_document_chk: check(
      "Part_source_document_required_if_type_source_document",
      sql`CASE WHEN ${t.type} = 'source-document' THEN ${t.source_document_sourceId} IS NOT NULL AND ${t.source_document_mediaType} IS NOT NULL AND ${t.source_document_title} IS NOT NULL ELSE TRUE END`
    ),
    source_url_chk: check(
      "Part_source_url_required_if_type_source_url",
      sql`CASE WHEN ${t.type} = 'source-url' THEN ${t.source_url_sourceId} IS NOT NULL AND ${t.source_url_url} IS NOT NULL ELSE TRUE END`
    ),
    text_chk: check(
      "Part_text_required_if_type_text",
      sql`CASE WHEN ${t.type} = 'text' THEN ${t.text_text} IS NOT NULL ELSE TRUE END`
    ),
    tool_chk: check(
      "Part_tool_required_if_type_tool",
      sql`CASE WHEN ${t.type} LIKE 'tool-%' THEN ${t.tool_toolCallId} IS NOT NULL AND ${t.tool_state} IS NOT NULL ELSE TRUE END`
    ),
  })
);

export type Part = InferSelectModel<typeof part>;

export const vote = pgTable(
  "Vote",
  {
    chatId: uuid("chatId")
      .notNull()
      .references(() => chat.id, {
        onDelete: "cascade",
      }),
    isUpvoted: boolean("isUpvoted").notNull(),
    messageId: uuid("messageId")
      .notNull()
      .references(() => message.id, {
        onDelete: "cascade",
      }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.chatId, table.messageId] }),
  })
);

export type Vote = InferSelectModel<typeof vote>;

export const document = pgTable(
  "Document",
  {
    content: text("content"),
    createdAt: timestamp("createdAt").notNull(),
    id: uuid("id").notNull().defaultRandom(),
    kind: varchar("kind", { enum: ["text", "code", "sheet"] })
      .notNull()
      .default("text"),
    messageId: uuid("messageId")
      .notNull()
      .references(() => message.id, {
        onDelete: "cascade",
      }),
    title: text("title").notNull(),
    userId: text("userId")
      .notNull()
      .references(() => user.id),
  },
  (table) => ({
    document_message_id_idx: index("Document_message_id_idx").on(
      table.messageId
    ),
    pk: primaryKey({ columns: [table.id, table.createdAt] }),
  })
);

export type Document = InferSelectModel<typeof document>;

export const suggestion = pgTable(
  "Suggestion",
  {
    createdAt: timestamp("createdAt").notNull(),
    description: text("description"),
    documentCreatedAt: timestamp("documentCreatedAt").notNull(),
    documentId: uuid("documentId").notNull(),
    id: uuid("id").notNull().defaultRandom(),
    isResolved: boolean("isResolved").notNull().default(false),
    originalText: text("originalText").notNull(),
    suggestedText: text("suggestedText").notNull(),
    userId: text("userId")
      .notNull()
      .references(() => user.id),
  },
  (table) => ({
    documentRef: foreignKey({
      columns: [table.documentId, table.documentCreatedAt],
      foreignColumns: [document.id, document.createdAt],
    }),
    pk: primaryKey({ columns: [table.id] }),
  })
);

export type Suggestion = InferSelectModel<typeof suggestion>;

export const generationCancellation = pgTable(
  "GenerationCancellation",
  {
    canceledAt: timestamp("canceledAt").notNull(),
    chatId: uuid("chatId").notNull(),
    messageId: uuid("messageId").notNull(),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.messageId, table.userId] }),
  })
);

// Guest ownership is separate from BetterAuth sessions and monetary credits.
// Retain expired identities after content cleanup so late usage remains guest usage.
export const eveGuest = pgTable(
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
  (t) => [
    check(
      "EveGuest_message_balance",
      sql`${t.remainingMessages} >= 0 and ${t.remainingMessages} <= ${t.messageLimit}`
    ),
    check("EveGuest_token_hash", sql`${t.tokenHash} ~ '^[0-9a-f]{64}$'`),
    index("EveGuest_expiry_idx").on(t.expiresAt),
  ]
);

export const eveGuestRate = pgTable(
  "EveGuestRate",
  {
    ipHash: varchar("ipHash", { length: 64 }).notNull(),
    requests: integer("requests").notNull(),
    startsAt: timestamp("startsAt", { withTimezone: true }).notNull(),
    windowSeconds: integer("windowSeconds").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.ipHash, t.windowSeconds, t.startsAt] }),
    check("EveGuestRate_requests", sql`${t.requests} >= 0`),
    check("EveGuestRate_window", sql`${t.windowSeconds} in (60, 2592000)`),
  ]
);

export const eveGuestMessage = pgTable(
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
  (t) => [
    primaryKey({ columns: [t.ownerId, t.operationId] }),
    check(
      "EveGuestMessage_state",
      sql`${t.state} in ('reserved', 'committed', 'released')`
    ),
    check(
      "EveGuestMessage_request_hash",
      sql`${t.requestHash} ~ '^[0-9a-f]{64}$'`
    ),
  ]
);

export const session = pgTable("session", {
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

export const account = pgTable("account", {
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

export const verification = pgTable("verification", {
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

export const mcpConnector = pgTable(
  "McpConnector",
  {
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    enabled: boolean("enabled").notNull().default(true),
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    name: varchar("name", { length: 256 }).notNull(),
    // Unique per user, used as namespace for tool IDs.
    nameId: varchar("nameId", { length: 256 }).notNull(),
    oauthClientId: text("oauthClientId"),
    oauthClientSecret: encryptedText("oauthClientSecret"),
    type: varchar("type", { enum: ["http", "sse"] })
      .notNull()
      .default("http"),
    updatedAt: timestamp("updatedAt")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    url: encryptedText("url").notNull(),
    // Null = global.
    userId: text("userId").references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => ({
    McpConnector_user_id_idx: index("McpConnector_user_id_idx").on(t.userId),
    McpConnector_user_name_id_idx: index("McpConnector_user_name_id_idx").on(
      t.userId,
      t.nameId
    ),
    McpConnector_user_name_id_unique: uniqueIndex(
      "McpConnector_user_name_id_unique"
    ).on(t.userId, t.nameId),
  })
);

export type McpConnector = InferSelectModel<typeof mcpConnector>;

export const mcpOAuthSession = pgTable(
  "McpOAuthSession",
  {
    // OAuthClientInformationFull from MCP SDK.
    clientInfo: encryptedJson<Record<string, unknown>>()("clientInfo"),
    // PKCE verifier.
    codeVerifier: encryptedText("codeVerifier"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    mcpConnectorId: uuid("mcpConnectorId")
      .notNull()
      .references(() => mcpConnector.id, { onDelete: "cascade" }),
    serverUrl: text("serverUrl").notNull(),
    // OAuth state parameter, unique for security.
    state: text("state").unique(),
    // OAuthTokens from MCP SDK.
    tokens: encryptedJson<Record<string, unknown>>()("tokens"),
    updatedAt: timestamp("updatedAt")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    McpOAuthSession_connector_idx: index("McpOAuthSession_connector_idx").on(
      t.mcpConnectorId
    ),
    McpOAuthSession_state_idx: index("McpOAuthSession_state_idx").on(t.state),
  })
);

export type McpOAuthSession = InferSelectModel<typeof mcpOAuthSession>;

export const schema = { account, session, user, verification };

// Metadata only. Eve owns the transcript and execution state.
export const eveChat = pgTable(
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
    uniqueIndex("EveChat_id_owner").on(table.id, table.ownerId),
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

export type EveChat = InferSelectModel<typeof eveChat>;

// One logical chat may contain several private native EVE sessions.
export const eveConversation = pgTable(
  "EveConversation",
  {
    chatId: uuid("chatId").notNull(),
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
    // Immutable creation intent; retained when the project is removed.
    initialProjectId: uuid("initialProjectId"),
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
    usageStreamIndex: integer("usageStreamIndex").notNull().default(0),
    visibility: varchar("visibility", { enum: ["private", "public"] })
      .notNull()
      .default("private"),
  },
  (table) => [
    check(
      "EveConversation_creation_kind",
      sql`${table.creationKind} in ('message', 'copy')`
    ),
    check(
      "EveConversation_copy_root",
      sql`${table.creationKind} <> 'copy' or (
      ${table.parentConversationId} is null and ${table.rootConversationId} is null and
      ${table.forkTurnId} is null and ${table.forkMessageId} is null and ${table.forkCheckpointId} is null and
      ${table.forkKind} is null
    )`
    ),
    uniqueIndex("EveConversation_id_owner").on(table.id, table.ownerId),
    uniqueIndex("EveConversation_id_owner_chat").on(
      table.id,
      table.ownerId,
      table.chatId
    ),
    index("EveConversation_owner_chat").on(table.ownerId, table.chatId),
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
        (${table.forkTurnId} is not null and ${table.forkTurnId} ~ '^turn_(0|[1-9][0-9]*)$' and ${table.forkMessageId} is null) or
        (${table.forkMessageId} is not null and ${table.forkMessageId} ~ '^seed_message_(0|[1-9][0-9]{0,3})$' and ${table.forkTurnId} is null)
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
export const eveConversationCopy = pgTable(
  "EveConversationCopy",
  {
    acceptedAt: timestamp("acceptedAt"),
    conversationId: uuid("conversationId").primaryKey(),
    documentsReady: boolean("documentsReady").notNull().default(false),
    ownerId: text("ownerId").notNull(),
    phase: text("phase", {
      enum: ["preparing", "accepted", "bound", "rejected"],
    })
      .notNull()
      .default("preparing"),
    plan: jsonb("plan").$type<EveCopyPlan>(),
    planHash: text("planHash").notNull(),
    projectionHash: text("projectionHash").notNull(),
    seed: jsonb("seed").$type<EveCopySeed>(),
    sourceConversationId: uuid("sourceConversationId").notNull(),
    sourceOwnerId: text("sourceOwnerId").notNull(),
    sourceSessionId: text("sourceSessionId").notNull(),
  },
  (table) => [
    uniqueIndex("EveConversationCopy_owner_identity").on(
      table.conversationId,
      table.ownerId
    ),
    foreignKey({
      columns: [table.conversationId, table.ownerId],
      foreignColumns: [eveConversation.id, eveConversation.ownerId],
      name: "EveConversationCopy_owner_fk",
    }),
    check(
      "EveConversationCopy_phase_payload",
      sql`(
    ${table.phase} = 'preparing' and ${table.plan} is not null and ${table.seed} is null and ${table.acceptedAt} is null
  ) or (
    ${table.phase} = 'accepted' and ${table.plan} is null and ${table.seed} is not null and ${table.acceptedAt} is not null and ${table.documentsReady}
  ) or (
    ${table.phase} = 'bound' and ${table.plan} is null and ${table.seed} is null and ${table.acceptedAt} is not null and ${table.documentsReady}
  ) or (
    ${table.phase} = 'rejected' and ${table.plan} is null and ${table.seed} is null and ${table.acceptedAt} is null
  )`
    ),
  ]
);

/** Receipt metadata is committed only after writing the allocated destination bytes. */
export const eveConversationCopyFile = pgTable(
  "EveConversationCopyFile",
  {
    conversationId: uuid("conversationId").notNull(),
    key: text("key").notNull(),
    mediaType: text("mediaType").notNull(),
    ownerId: text("ownerId").notNull(),
    sha256: text("sha256").notNull(),
    size: integer("size").notNull(),
    writtenAt: timestamp("writtenAt"),
  },
  (table) => [
    primaryKey({ columns: [table.conversationId, table.key] }),
    foreignKey({
      columns: [table.conversationId, table.ownerId],
      foreignColumns: [
        eveConversationCopy.conversationId,
        eveConversationCopy.ownerId,
      ],
      name: "EveConversationCopyFile_copy_owner_fk",
    }),
    check("EveConversationCopyFile_size", sql`${table.size} > 0`),
    check(
      "EveConversationCopyFile_hash",
      sql`${table.sha256} ~ '^[a-f0-9]{64}$'`
    ),
  ]
);

/** Immutable fan-out intent. Native sessions remain the only transcript store. */
export const eveResponseGroup = pgTable(
  "EveResponseGroup",
  {
    candidateOperationIds: uuid("candidateOperationIds").array().notNull(),
    candidates: jsonb("candidates").$type<
      {
        modelId: string;
        operationId: string;
        rejection?: { error: string; code?: "project_not_found" };
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

/** Removing a project detaches its conversations without deleting their native sessions. */
export const eveChatProject = pgTable(
  "EveChatProject",
  {
    chatId: uuid("chatId").primaryKey(),
    ownerId: text("ownerId").notNull(),
    projectId: uuid("projectId").notNull(),
  },
  (table) => [
    index("EveChatProject_project").on(table.projectId),
    foreignKey({
      columns: [table.chatId, table.ownerId],
      foreignColumns: [eveChat.id, eveChat.ownerId],
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.projectId, table.ownerId],
      foreignColumns: [project.id, project.userId],
    }).onDelete("cascade"),
  ]
);

/** Feedback references native message IDs without copying the Eve transcript. */
export const eveVote = pgTable(
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
export const eveStoredFile = pgTable(
  "EveStoredFile",
  {
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    key: text("key").primaryKey(),
    ownerId: text("ownerId")
      .notNull()
      .references(() => user.id),
    state: text("state", { enum: ["active", "deleting", "deleted"] })
      .notNull()
      .default("active"),
  },
  (table) => [
    index("EveStoredFile_owner").on(table.ownerId),
    uniqueIndex("EveStoredFile_key_owner").on(table.key, table.ownerId),
  ]
);

export const eveFileReference = pgTable(
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
export const eveCodeSandbox = pgTable(
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

export const eveUsage = pgTable(
  "EveUsage",
  {
    chargedCents: integer("chargedCents").notNull().default(0),
    costUsd: numeric("costUsd", { precision: 24, scale: 12 }),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    eventId: text("eventId").primaryKey(),
    generationId: text("generationId"),
    ownerId: text("ownerId")
      .notNull()
      .references(() => user.id),
    sessionId: text("sessionId").notNull(),
    turnId: text("turnId").notNull(),
  },
  (table) => [index("EveUsage_session_turn").on(table.sessionId, table.turnId)]
);

export const eveDocumentRevision = pgTable(
  "EveDocumentRevision",
  {
    content: text("content").notNull(),
    conversationId: uuid("conversationId").notNull(),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    documentId: uuid("documentId").notNull(),
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
    uniqueIndex("EveDocumentRevision_identity").on(
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

export const eveDocumentHead = pgTable(
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

export type EveDocumentRevision = InferSelectModel<typeof eveDocumentRevision>;

export const eveDocumentCheckpoint = pgTable(
  "EveDocumentCheckpoint",
  {
    conversationId: uuid("conversationId").notNull(),
    ownerId: text("ownerId").notNull(),
    turnIndex: integer("turnIndex").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.conversationId, table.turnIndex] }),
    uniqueIndex("EveDocumentCheckpoint_owner_identity").on(
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

export const eveDocumentCheckpointEntry = pgTable(
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
export const eveNamedDocumentCheckpoint = pgTable(
  "EveNamedDocumentCheckpoint",
  {
    checkpointId: uuid("checkpointId").notNull(),
    conversationId: uuid("conversationId").notNull(),
    ownerId: text("ownerId").notNull(),
    turnIndex: integer("turnIndex").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.conversationId, table.checkpointId] }),
    uniqueIndex("EveNamedDocumentCheckpoint_owner_identity").on(
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

export const eveNamedDocumentCheckpointEntry = pgTable(
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
export const eveImportedDocumentCheckpoint = pgTable(
  "EveImportedDocumentCheckpoint",
  {
    conversationId: uuid("conversationId").notNull(),
    messageIndex: integer("messageIndex").notNull(),
    ownerId: text("ownerId").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.conversationId, table.messageIndex] }),
    uniqueIndex("EveImportedDocumentCheckpoint_owner_identity").on(
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

export const eveImportedDocumentCheckpointEntry = pgTable(
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
