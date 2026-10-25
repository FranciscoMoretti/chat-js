// Shared by Next.js and the standalone EVE server; env guards server credentials.
import type { User, UserModelPreference } from "./schema";
import { eq } from "drizzle-orm";

import { db } from "./client";
import { user, userModelPreference } from "./schema";

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

const getUserModelPreferences = async ({
  userId,
}: {
  readonly userId: string;
}): Promise<UserModelPreference[]> =>
  await db
    .select()
    .from(userModelPreference)
    .where(eq(userModelPreference.userId, userId));

const upsertUserModelPreference = async ({
  userId,
  modelId,
  enabled,
}: {
  readonly userId: string;
  readonly modelId: string;
  readonly enabled: boolean;
}): Promise<void> => {
  await db
    .insert(userModelPreference)
    .values({
      createdAt: new Date(),
      enabled,
      modelId,
      updatedAt: new Date(),
      userId,
    })
    .onConflictDoUpdate({
      set: { enabled, updatedAt: new Date() },
      target: [userModelPreference.userId, userModelPreference.modelId],
    });
};

export { getUserById, getUserModelPreferences, upsertUserModelPreference };
