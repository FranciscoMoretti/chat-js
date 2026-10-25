import {
  foreignKey,
  index,
  jsonb,
  pgTable,
  text,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { eveChat } from "@/lib/db/schema";

/** Optional display output, shared by native branches of the same chat. */
export const eveFollowup = pgTable(
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
