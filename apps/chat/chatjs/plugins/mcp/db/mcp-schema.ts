import type { InferSelectModel } from "drizzle-orm";
import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { user } from "@/lib/db/schema";
import { encryptedJson, encryptedText } from "./encrypted-text";

const mcpConnector = pgTable(
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
    requireApproval: boolean("requireApproval").notNull().default(false),
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
  (columns) => [
    index("McpConnector_user_id_idx").on(columns.userId),
    index("McpConnector_user_name_id_idx").on(columns.userId, columns.nameId),
    uniqueIndex("McpConnector_user_name_id_unique").on(
      columns.userId,
      columns.nameId
    ),
  ]
);

type McpConnector = InferSelectModel<typeof mcpConnector>;

const mcpOAuthSession = pgTable(
  "McpOAuthSession",
  {
    // OAuthClientInformationFull from MCP SDK.
    clientInfo: encryptedJson("clientInfo"),
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
    tokens: encryptedJson("tokens"),
    updatedAt: timestamp("updatedAt")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (columns) => [
    index("McpOAuthSession_connector_idx").on(columns.mcpConnectorId),
    index("McpOAuthSession_state_idx").on(columns.state),
  ]
);

type McpOAuthSession = InferSelectModel<typeof mcpOAuthSession>;

export { mcpConnector, mcpOAuthSession };
export type { McpConnector, McpOAuthSession };
