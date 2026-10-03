/* oxlint-disable import/no-relative-parent-imports  --
 * import/no-relative-parent-imports (#530): Keep the explicit "../eve/copy-journal-contract" dependency within this package instead of introducing an alias or barrel API.
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
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

import type { EveCopyPlan, EveCopySeed } from "../eve/copy-journal-contract";
import { encryptedJson, encryptedText } from "./encrypted-text";
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable import/group-exports, no-magic-numbers, typescript/prefer-readonly-parameter-types  --
 * import/group-exports (#523): eveWorkflowBackend stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named eveWorkflowBackend API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * no-magic-numbers (#517): eveWorkflowBackend uses 1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/prefer-readonly-parameter-types (#565): eveWorkflowBackend accepts table; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
/** One application database belongs to one durable workflow world. */
export const eveWorkflowBackend = pgTable(
  "EveWorkflowBackend",
  {
    id: integer("id").primaryKey().default(1),
    world: text("world").notNull(),
  },
  (table) => [check("EveWorkflowBackend_singleton", sql`${table.id} = 1`)]
);
/* oxlint-enable import/group-exports, no-magic-numbers, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/group-exports  --
 * import/group-exports (#523): user stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named user API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
export const user = pgTable("user", {
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
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports  --
 * import/group-exports (#523): User stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named User API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
export type User = InferSelectModel<typeof user>;
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports, no-magic-numbers  --
 * import/group-exports (#523): userCredit stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named userCredit API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * no-magic-numbers (#517): userCredit uses 50 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 */
export const userCredit = pgTable("UserCredit", {
  /** Balance in cents. Default = $0.50 */
  credits: integer("credits").notNull().default(50),
  userId: text("userId")
    .primaryKey()
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});
/* oxlint-enable import/group-exports, no-magic-numbers */

/* oxlint-disable import/group-exports  --
 * import/group-exports (#523): UserCredit stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named UserCredit API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
export type UserCredit = InferSelectModel<typeof userCredit>;
/* oxlint-enable import/group-exports */

/* oxlint-disable id-length, import/group-exports, typescript/prefer-readonly-parameter-types  --
 * id-length (#506): userModelPreference uses t as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 * import/group-exports (#523): userModelPreference stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named userModelPreference API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * typescript/prefer-readonly-parameter-types (#565): userModelPreference accepts t; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
// oxlint-disable-next-line typescript/no-deprecated -- #583: Preserve the existing schema constraint definitions; changing Drizzle table configuration requires migration diff verification.
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
/* oxlint-enable id-length, import/group-exports, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/group-exports  --
 * import/group-exports (#523): UserModelPreference stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named UserModelPreference API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
export type UserModelPreference = InferSelectModel<typeof userModelPreference>;
/* oxlint-enable import/group-exports */

/* oxlint-disable id-length, import/group-exports, typescript/prefer-readonly-parameter-types  --
 * id-length (#506): project uses t as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 * import/group-exports (#523): project stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named project API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * typescript/prefer-readonly-parameter-types (#565): project accepts t; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
// oxlint-disable-next-line typescript/no-deprecated -- #583: Preserve the existing schema constraint definitions; changing Drizzle table configuration requires migration diff verification.
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
    Project_id_user: unique("Project_id_user").on(t.id, t.userId),
    Project_user_id_idx: index("Project_user_id_idx").on(t.userId),
  })
);
/* oxlint-enable id-length, import/group-exports, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/group-exports  --
 * import/group-exports (#523): Project stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named Project API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
export type Project = InferSelectModel<typeof project>;
/* oxlint-enable import/group-exports */

/* oxlint-disable id-length, import/group-exports, typescript/prefer-readonly-parameter-types  --
 * id-length (#506): eveGuest uses t as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 * import/group-exports (#523): eveGuest stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named eveGuest API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * typescript/prefer-readonly-parameter-types (#565): eveGuest accepts t; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
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
/* oxlint-enable id-length, import/group-exports, typescript/prefer-readonly-parameter-types */

/* oxlint-disable id-length, import/group-exports, typescript/prefer-readonly-parameter-types  --
 * id-length (#506): eveGuestRate uses t as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 * import/group-exports (#523): eveGuestRate stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named eveGuestRate API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * typescript/prefer-readonly-parameter-types (#565): eveGuestRate accepts t; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
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
/* oxlint-enable id-length, import/group-exports, typescript/prefer-readonly-parameter-types */

/* oxlint-disable id-length, import/group-exports, typescript/prefer-readonly-parameter-types  --
 * id-length (#506): eveGuestMessage uses t as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 * import/group-exports (#523): eveGuestMessage stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named eveGuestMessage API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * typescript/prefer-readonly-parameter-types (#565): eveGuestMessage accepts t; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
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
/* oxlint-enable id-length, import/group-exports, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/group-exports  --
 * import/group-exports (#523): session stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named session API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
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
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports  --
 * import/group-exports (#523): account stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named account API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
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
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports  --
 * import/group-exports (#523): verification stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named verification API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
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
/* oxlint-enable import/group-exports */

/* oxlint-disable id-length, import/group-exports, typescript/prefer-readonly-parameter-types  --
 * id-length (#506): mcpConnector uses t as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 * import/group-exports (#523): mcpConnector stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named mcpConnector API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * typescript/prefer-readonly-parameter-types (#565): mcpConnector accepts t; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
// oxlint-disable-next-line typescript/no-deprecated -- #583: Preserve the existing schema constraint definitions; changing Drizzle table configuration requires migration diff verification.
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
/* oxlint-enable id-length, import/group-exports, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/group-exports  --
 * import/group-exports (#523): McpConnector stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named McpConnector API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
export type McpConnector = InferSelectModel<typeof mcpConnector>;
/* oxlint-enable import/group-exports */

/* oxlint-disable id-length, import/group-exports, typescript/prefer-readonly-parameter-types  --
 * id-length (#506): mcpOAuthSession uses t as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 * import/group-exports (#523): mcpOAuthSession stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named mcpOAuthSession API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * typescript/prefer-readonly-parameter-types (#565): mcpOAuthSession accepts t; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
// oxlint-disable-next-line typescript/no-deprecated -- #583: Preserve the existing schema constraint definitions; changing Drizzle table configuration requires migration diff verification.
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
/* oxlint-enable id-length, import/group-exports, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/group-exports  --
 * import/group-exports (#523): McpOAuthSession stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named McpOAuthSession API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
export type McpOAuthSession = InferSelectModel<typeof mcpOAuthSession>;
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports  --
 * import/group-exports (#523): schema stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named schema API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
export const schema = { account, session, user, verification };
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports, typescript/prefer-readonly-parameter-types  --
 * import/group-exports (#523): eveChat stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named eveChat API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * typescript/prefer-readonly-parameter-types (#565): eveChat accepts table; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
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
/* oxlint-enable import/group-exports, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/group-exports  --
 * import/group-exports (#523): EveChat stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named EveChat API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
export type EveChat = InferSelectModel<typeof eveChat>;
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports, max-lines-per-function, no-magic-numbers, typescript/prefer-readonly-parameter-types  --
 * import/group-exports (#523): eveConversation stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named eveConversation API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * max-lines-per-function (#510): eveConversation keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): eveConversation uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/prefer-readonly-parameter-types (#565): eveConversation accepts table; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
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
    initialRequest: jsonb("initialRequest").$type<unknown>(),
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
    unique("EveConversation_id_owner").on(table.id, table.ownerId),
    unique("EveConversation_id_owner_chat").on(
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
/* oxlint-enable import/group-exports, max-lines-per-function, no-magic-numbers, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/group-exports, typescript/prefer-readonly-parameter-types  --
 * import/group-exports (#523): eveConversationCopy stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named eveConversationCopy API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * typescript/prefer-readonly-parameter-types (#565): eveConversationCopy accepts table; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
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
    unique("EveConversationCopy_owner_identity").on(
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
/* oxlint-enable import/group-exports, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/group-exports, typescript/prefer-readonly-parameter-types  --
 * import/group-exports (#523): eveConversationCopyFile stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named eveConversationCopyFile API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * typescript/prefer-readonly-parameter-types (#565): eveConversationCopyFile accepts table; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
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
/* oxlint-enable import/group-exports, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/group-exports, typescript/prefer-readonly-parameter-types  --
 * import/group-exports (#523): eveResponseGroup stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named eveResponseGroup API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * typescript/prefer-readonly-parameter-types (#565): eveResponseGroup accepts table; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
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
/* oxlint-enable import/group-exports, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/group-exports, typescript/prefer-readonly-parameter-types  --
 * import/group-exports (#523): eveChatProject stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named eveChatProject API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * typescript/prefer-readonly-parameter-types (#565): eveChatProject accepts table; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
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
/* oxlint-enable import/group-exports, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/group-exports, typescript/prefer-readonly-parameter-types  --
 * import/group-exports (#523): eveVote stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named eveVote API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * typescript/prefer-readonly-parameter-types (#565): eveVote accepts table; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
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
/* oxlint-enable import/group-exports, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/group-exports, typescript/prefer-readonly-parameter-types  --
 * import/group-exports (#523): eveStoredFile stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named eveStoredFile API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * typescript/prefer-readonly-parameter-types (#565): eveStoredFile accepts table; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
/** Application-owned storage identity; transcript contents remain in EVE. */
export const eveStoredFile = pgTable(
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
/* oxlint-enable import/group-exports, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/group-exports, typescript/prefer-readonly-parameter-types  --
 * import/group-exports (#523): eveFileReference stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named eveFileReference API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * typescript/prefer-readonly-parameter-types (#565): eveFileReference accepts table; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
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
/* oxlint-enable import/group-exports, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/group-exports, typescript/prefer-readonly-parameter-types  --
 * import/group-exports (#523): eveCodeSandbox stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named eveCodeSandbox API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * typescript/prefer-readonly-parameter-types (#565): eveCodeSandbox accepts table; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
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
/* oxlint-enable import/group-exports, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/group-exports, no-magic-numbers, typescript/prefer-readonly-parameter-types  --
 * import/group-exports (#523): eveSubagentSession stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named eveSubagentSession API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * no-magic-numbers (#517): eveSubagentSession uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/prefer-readonly-parameter-types (#565): eveSubagentSession accepts table; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
/** Native child identity and billing progress; transcript stays in EVE. */
export const eveSubagentSession = pgTable(
  "EveSubagentSession",
  {
    conversationId: uuid("conversationId").notNull(),
    ownerId: text("ownerId").notNull(),
    parentSessionId: text("parentSessionId").notNull(),
    rootTurnId: text("rootTurnId").notNull(),
    sessionId: text("sessionId").primaryKey(),
    usageStreamIndex: integer("usageStreamIndex").notNull().default(0),
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
/* oxlint-enable import/group-exports, no-magic-numbers, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/group-exports, no-magic-numbers, typescript/prefer-readonly-parameter-types  --
 * import/group-exports (#523): eveUsage stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named eveUsage API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * no-magic-numbers (#517): eveUsage uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/prefer-readonly-parameter-types (#565): eveUsage accepts table; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
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
  (table) => [
    index("EveUsage_session_turn").on(table.sessionId, table.turnId),
    index("EveUsage_unpriced_owner")
      .on(table.ownerId)
      .where(sql`${table.costUsd} is null`),
  ]
);
/* oxlint-enable import/group-exports, no-magic-numbers, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/group-exports, typescript/prefer-readonly-parameter-types  --
 * import/group-exports (#523): eveDocumentRevision stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named eveDocumentRevision API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * typescript/prefer-readonly-parameter-types (#565): eveDocumentRevision accepts table; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
export const eveDocumentRevision = pgTable(
  "EveDocumentRevision",
  {
    content: text("content").notNull(),
    conversationId: uuid("conversationId").notNull(),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    documentId: uuid("documentId").notNull(),
    fileIds: jsonb("fileIds").$type<string[]>().notNull().default([]),
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
/* oxlint-enable import/group-exports, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/group-exports, typescript/prefer-readonly-parameter-types  --
 * import/group-exports (#523): eveDocumentHead stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named eveDocumentHead API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * typescript/prefer-readonly-parameter-types (#565): eveDocumentHead accepts table; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
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
/* oxlint-enable import/group-exports, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/group-exports  --
 * import/group-exports (#523): EveDocumentRevision stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named EveDocumentRevision API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
export type EveDocumentRevision = InferSelectModel<typeof eveDocumentRevision>;
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports, typescript/prefer-readonly-parameter-types  --
 * import/group-exports (#523): eveDocumentCheckpoint stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named eveDocumentCheckpoint API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * typescript/prefer-readonly-parameter-types (#565): eveDocumentCheckpoint accepts table; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
export const eveDocumentCheckpoint = pgTable(
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
/* oxlint-enable import/group-exports, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/group-exports, typescript/prefer-readonly-parameter-types  --
 * import/group-exports (#523): eveDocumentCheckpointEntry stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named eveDocumentCheckpointEntry API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * typescript/prefer-readonly-parameter-types (#565): eveDocumentCheckpointEntry accepts table; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
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
/* oxlint-enable import/group-exports, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/group-exports, typescript/prefer-readonly-parameter-types  --
 * import/group-exports (#523): eveNamedDocumentCheckpoint stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named eveNamedDocumentCheckpoint API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * typescript/prefer-readonly-parameter-types (#565): eveNamedDocumentCheckpoint accepts table; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
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
/* oxlint-enable import/group-exports, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/group-exports, typescript/prefer-readonly-parameter-types  --
 * import/group-exports (#523): eveNamedDocumentCheckpointEntry stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named eveNamedDocumentCheckpointEntry API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * typescript/prefer-readonly-parameter-types (#565): eveNamedDocumentCheckpointEntry accepts table; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
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
/* oxlint-enable import/group-exports, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/group-exports, typescript/prefer-readonly-parameter-types  --
 * import/group-exports (#523): eveImportedDocumentCheckpoint stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named eveImportedDocumentCheckpoint API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * typescript/prefer-readonly-parameter-types (#565): eveImportedDocumentCheckpoint accepts table; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
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
/* oxlint-enable import/group-exports, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/group-exports, typescript/prefer-readonly-parameter-types  --
 * import/group-exports (#523): eveImportedDocumentCheckpointEntry stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named eveImportedDocumentCheckpointEntry API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * typescript/prefer-readonly-parameter-types (#565): eveImportedDocumentCheckpointEntry accepts table; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
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
/* oxlint-enable import/group-exports, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/group-exports, typescript/prefer-readonly-parameter-types  --
 * import/group-exports (#523): eveSearchText stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named eveSearchText API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * typescript/prefer-readonly-parameter-types (#565): eveSearchText accepts table; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
/** Rebuildable display-text projection; EVE remains the transcript source of truth. */
export const eveSearchText = pgTable(
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
/* oxlint-enable import/group-exports, typescript/prefer-readonly-parameter-types */

/* oxlint-disable max-lines -- #509: This schema.ts module keeps its existing API and workflow boundaries; splitting it requires an ownership design. EOF-scoped exception applies only to this file-level line metric. */
