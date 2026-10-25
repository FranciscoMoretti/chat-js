import type { InferSelectModel } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
  unique,
  index,
  foreignKey,
} from "drizzle-orm/pg-core";
import { user, eveChat } from "@/lib/db/schema";

const project = pgTable(
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
  (columns) => [
    unique("Project_id_user").on(columns.id, columns.userId),
    index("Project_user_id_idx").on(columns.userId),
  ]
);

type Project = InferSelectModel<typeof project>;

/** Removing a project detaches its conversations without deleting their native sessions. */
const eveChatProject = pgTable(
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

export { project, eveChatProject };
export type { Project };
