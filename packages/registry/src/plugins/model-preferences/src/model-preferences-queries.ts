import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { userModelPreference } from "./model-preferences-schema";
import type { UserModelPreference } from "./model-preferences-schema";

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

export { getUserModelPreferences, upsertUserModelPreference };
