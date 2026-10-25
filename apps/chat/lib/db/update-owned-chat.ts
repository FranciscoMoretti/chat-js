import { and, eq, or, sql } from "drizzle-orm";
import { db } from "./client";
import { eveChat } from "./schema";

/**
 * Coordinate metadata changes with core chat creation and deletion.
 * A chat or legacy conversation ID is accepted. Unavailable chats return null.
 * Callbacks return null before writing to reject; thrown failures roll back.
 */
export const updateOwnedChat = async <Result>(
  identity: { readonly ownerId: string; readonly chatId: string },
  mutate: (context: {
    readonly tx: Readonly<
      Pick<typeof db, "select" | "insert" | "update" | "delete">
    >;
    readonly chatId: string;
  }) => Promise<Result | null>
): Promise<Result | null> =>
  await db.transaction(async (tx) => {
    const { ownerId, chatId: routeId } = identity;
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`eve-family:${ownerId}`}, 0))`
    );
    const [chat] = await tx
      .select({ id: eveChat.id })
      .from(eveChat)
      .where(
        and(
          eq(eveChat.ownerId, ownerId),
          or(
            eq(eveChat.id, routeId),
            sql`exists (
              select 1 from "EveConversation" route_member
              where route_member."chatId" = ${eveChat.id}
                and route_member."ownerId" = ${ownerId}
                and route_member."id" = ${routeId}
            )`
          ),
          sql`exists (
            select 1 from "EveConversation" member
            where member."chatId" = ${eveChat.id}
              and member."ownerId" = ${ownerId}
              and member."state" = 'bound'
          )`
        )
      );
    if (chat === undefined) {
      return null;
    }
    const result = await mutate({ tx, chatId: chat.id });
    if (result !== null) {
      await tx
        .update(eveChat)
        .set({ updatedAt: new Date() })
        .where(eq(eveChat.id, chat.id));
    }
    return result;
  });
