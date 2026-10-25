import type { InferSelectModel } from "drizzle-orm";
import {
  boolean,
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { user } from "@/lib/db/schema";

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

export { userModelPreference };
export type { UserModelPreference };
