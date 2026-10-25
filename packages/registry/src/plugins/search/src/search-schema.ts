import { sql } from "drizzle-orm";
import {
  foreignKey,
  index,
  pgTable,
  primaryKey,
  text,
  uuid,
} from "drizzle-orm/pg-core";
import { eveConversation } from "@/lib/db/schema";

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
