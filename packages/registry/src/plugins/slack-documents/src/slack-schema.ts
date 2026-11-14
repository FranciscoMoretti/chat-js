import {
  boolean,
  foreignKey,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

export const slackConversation = pgTable(
  "SlackConversation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: text("teamId").notNull(),
    channelId: text("channelId").notNull(),
    threadTs: text("threadTs").notNull(),
    direct: boolean("direct").notNull(),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (table) => [
    unique("SlackConversation_team_thread").on(
      table.teamId,
      table.channelId,
      table.threadTs
    ),
    unique("SlackConversation_id_team").on(table.id, table.teamId),
    // The pinned EVE channel addresses threads by channel + timestamp. Reject collisions before native dispatch.
    unique("SlackConversation_native_address").on(
      table.channelId,
      table.threadTs
    ),
  ]
);
export const slackSession = pgTable(
  "SlackSession",
  {
    sessionId: text("sessionId").primaryKey(),
    conversationId: uuid("conversationId").notNull(),
    teamId: text("teamId").notNull(),
    rootSessionId: text("rootSessionId").notNull(),
    rootTurnId: text("rootTurnId"),
  },
  (table) => [
    foreignKey({
      columns: [table.conversationId, table.teamId],
      foreignColumns: [slackConversation.id, slackConversation.teamId],
    }),
    unique("SlackSession_id_team").on(table.sessionId, table.teamId),
  ]
);
export const slackDocument = pgTable(
  "SlackDocument",
  {
    id: uuid("id").primaryKey(),
    conversationId: uuid("conversationId").notNull(),
    teamId: text("teamId").notNull(),
    creatorId: text("creatorId").notNull(),
    headRevisionId: uuid("headRevisionId"),
  },
  (table) => [
    foreignKey({
      columns: [table.conversationId, table.teamId],
      foreignColumns: [slackConversation.id, slackConversation.teamId],
    }),
    unique("SlackDocument_id_conversation_team").on(
      table.id,
      table.conversationId,
      table.teamId
    ),
  ]
);
export const slackDocumentRevision = pgTable(
  "SlackDocumentRevision",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("documentId").notNull(),
    conversationId: uuid("conversationId").notNull(),
    teamId: text("teamId").notNull(),
    actorId: text("actorId").notNull(),
    operationId: text("operationId").notNull(),
    requestHash: text("requestHash").notNull(),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    content: text("content").notNull(),
    fileIds: jsonb("fileIds").$type<string[]>().notNull().default([]),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.documentId, table.conversationId, table.teamId],
      foreignColumns: [
        slackDocument.id,
        slackDocument.conversationId,
        slackDocument.teamId,
      ],
    }),
    unique("SlackDocumentRevision_operation").on(
      table.conversationId,
      table.operationId
    ),
  ]
);
