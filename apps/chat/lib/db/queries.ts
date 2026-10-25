// Shared by Next.js and the standalone EVE server; env guards server credentials.
import type { User } from "./schema";
import { eq } from "drizzle-orm";

import { db } from "./client";
import { user } from "./schema";

const SINGLE_MATCH_LIMIT = 1;
const FIRST_RESULT_INDEX = 0;
const getUserById = async ({
  userId,
}: {
  readonly userId: string;
}): Promise<User | undefined> => {
  const users = await db
    .select()
    .from(user)
    .where(eq(user.id, userId))
    .limit(SINGLE_MATCH_LIMIT);
  return users[FIRST_RESULT_INDEX];
};

export { getUserById };
