import type { InferSelectModel } from "drizzle-orm";
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  json,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

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
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  chatId: uuid("chatId")
    .notNull()
    .references(() => chat.id, {
      onDelete: "cascade",
    }),
  parentMessageId: uuid("parentMessageId"),
  role: varchar("role").notNull(),
  // parts column removed - parts are now stored in Part table
  attachments: json("attachments").notNull(),
  createdAt: timestamp("createdAt").notNull(),
  annotations: json("annotations"),
  selectedModel: json("selectedModel"),
  selectedTool: varchar("selectedTool", { length: 256 }).default(""),
  parallelGroupId: uuid("parallelGroupId"),
  parallelIndex: integer("parallelIndex"),
  isPrimaryParallel: boolean("isPrimaryParallel"),
  lastContext: json("lastContext"),
  activeStreamId: varchar("activeStreamId", { length: 64 }),
  /** Timestamp when this message's stream was canceled by the user. Null means not canceled. */
  canceledAt: timestamp("canceledAt"),
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
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    messageId: uuid("messageId")
      .notNull()
      .references(() => message.id, { onDelete: "cascade" }),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    order: integer("order").notNull().default(0),
    type: varchar("type").notNull(),
    // Text fields
    text_text: text("text_text"),
    // Reasoning fields
    reasoning_text: text("reasoning_text"),
    // File fields
    file_mediaType: varchar("file_mediaType"),
    file_filename: varchar("file_filename"),
    file_url: varchar("file_url"),
    // Source URL fields
    source_url_sourceId: varchar("source_url_sourceId"),
    source_url_url: varchar("source_url_url"),
    source_url_title: varchar("source_url_title"),
    // Source Document fields
    source_document_sourceId: varchar("source_document_sourceId"),
    source_document_mediaType: varchar("source_document_mediaType"),
    source_document_title: varchar("source_document_title"),
    source_document_filename: varchar("source_document_filename"),
    // Tool fields (generic for all tool-* parts)
    tool_name: varchar("tool_name"),
    tool_toolCallId: varchar("tool_toolCallId"),
    tool_state: varchar("tool_state"),
    tool_input: json("tool_input"),
    tool_output: json("tool_output"),
    tool_errorText: varchar("tool_errorText"),
    // Data fields (generic bucket for all data-* parts)
    data_type: varchar("data_type"),
    data_blob: json("data_blob"),
    // Provider metadata
    providerMetadata: json("providerMetadata"),
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
