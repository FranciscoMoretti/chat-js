import { boolean, pgTable, primaryKey, text, uuid } from "drizzle-orm/pg-core";
import { eveConversation } from "@/lib/db/schema";

/** Feedback references native message IDs without copying the Eve transcript. */
export const eveVote = pgTable(
  "EveVote",
  {
    branchId: uuid("branchId")
      .notNull()
      .references(() => eveConversation.id, { onDelete: "cascade" }),
    isUpvoted: boolean("isUpvoted").notNull(),
    messageId: text("messageId").notNull(),
  },
  (table) => [primaryKey({ columns: [table.branchId, table.messageId] })]
);
