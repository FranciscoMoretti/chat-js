import { integer, pgTable, text } from "drizzle-orm/pg-core";
import { user } from "@/lib/db/schema";

const INITIAL_USER_CREDIT_BALANCE_CENTS = 50;

const userCredit = pgTable("UserCredit", {
  /** Balance in cents. Default = $0.50 */
  balanceCents: integer("credits")
    .notNull()
    .default(INITIAL_USER_CREDIT_BALANCE_CENTS),
  userId: text("userId")
    .primaryKey()
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export { userCredit };
