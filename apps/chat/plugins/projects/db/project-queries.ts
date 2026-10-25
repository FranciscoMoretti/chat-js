import type { PgSelectBase, PgSelectWithout } from "drizzle-orm/pg-core";
import type { GetSelectTableName } from "drizzle-orm/query-builders/select.types";
import { and, desc, eq, or, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { eveChat, eveConversation } from "@/lib/db/schema";
import { project, eveChatProject } from "./project-schema";

const hasQueryRow: (row: unknown) => boolean = Boolean;
type ProjectWriteTransaction = Readonly<
  Pick<typeof db, "select" | "execute" | "insert" | "delete" | "update">
>;
const createProject = ({
  id,
  userId,
  name,
  instructions = "",
  icon,
  iconColor,
}: {
  readonly id: string;
  readonly userId: string;
  readonly name: string;
  readonly instructions?: string;
  readonly icon?: string;
  readonly iconColor?: string;
}): ReturnType<ReturnType<typeof db.insert<typeof project>>["values"]> =>
  db.insert(project).values({
    createdAt: new Date(),
    ...(typeof icon === "string" && icon !== "" && { icon }),
    ...(typeof iconColor === "string" && iconColor !== "" && { iconColor }),
    id,
    instructions,
    name,
    updatedAt: new Date(),
    userId,
  });

const getProjectsByUserId = ({
  userId,
}: {
  readonly userId: string;
}): PgSelectWithout<
  PgSelectBase<
    GetSelectTableName<typeof project>,
    (typeof project)["_"]["columns"],
    "single",
    Record<GetSelectTableName<typeof project>, "not-null">
  >,
  false,
  "where" | "orderBy"
> =>
  db
    .select()
    .from(project)
    .where(eq(project.userId, userId))
    .orderBy(desc(project.updatedAt));

const getProjectById = async ({
  id,
}: {
  readonly id: string;
}): Promise<typeof project.$inferSelect> => {
  const [selectedProject] = await db
    .select()
    .from(project)
    .where(eq(project.id, id));
  return selectedProject;
};

const updateProject = ({
  id,
  updates,
}: {
  readonly id: string;
  readonly updates: Partial<{
    readonly name: string;
    readonly instructions: string;
    readonly icon: string;
    readonly iconColor: string;
  }>;
}): ReturnType<
  ReturnType<ReturnType<typeof db.update<typeof project>>["set"]>["where"]
> =>
  db
    .update(project)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(project.id, id));

const deleteProject = ({
  id,
}: {
  readonly id: string;
}): ReturnType<ReturnType<typeof db.delete<typeof project>>["where"]> =>
  db.delete(project).where(eq(project.id, id));

const assignEveConversationProject = async (
  ownerId: string,
  routeId: string,
  projectId: string | null
): Promise<{ conversationId: string; projectId: string | null } | null> =>
  await db.transaction(async (tx: ProjectWriteTransaction) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`eve-family:${ownerId}`}, 0))`
    );
    const [logicalChat] = await tx
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
    if (!hasQueryRow(logicalChat)) {
      return null;
    }
    if (projectId === null) {
      await tx
        .delete(eveChatProject)
        .where(eq(eveChatProject.chatId, logicalChat.id));
    } else {
      const [target] = await tx
        .select({ id: project.id })
        .from(project)
        .where(and(eq(project.id, projectId), eq(project.userId, ownerId)))
        .for("key share");
      if (!hasQueryRow(target)) {
        return null;
      }
      await tx
        .insert(eveChatProject)
        .values({ chatId: logicalChat.id, ownerId, projectId })
        .onConflictDoUpdate({
          set: { projectId },
          target: eveChatProject.chatId,
        });
    }
    await tx
      .update(eveChat)
      .set({ updatedAt: new Date() })
      .where(eq(eveChat.id, logicalChat.id));
    return { conversationId: routeId, projectId };
  });
const getEveConversationProject = async (
  ownerId: string,
  routeId: string
): Promise<Pick<
  typeof project.$inferSelect,
  "id" | "instructions" | "name" | "icon" | "iconColor"
> | null> => {
  const [assigned] = await db
    .select({
      id: project.id,
      icon: project.icon,
      iconColor: project.iconColor,
      instructions: project.instructions,
      name: project.name,
    })
    .from(eveChat)
    .leftJoin(
      eveConversation,
      and(
        eq(eveConversation.chatId, eveChat.id),
        eq(eveConversation.ownerId, eveChat.ownerId),
        eq(eveConversation.id, routeId)
      )
    )
    .innerJoin(
      eveChatProject,
      and(
        eq(eveChatProject.chatId, eveChat.id),
        eq(eveChatProject.ownerId, eveChat.ownerId)
      )
    )
    .innerJoin(project, eq(project.id, eveChatProject.projectId))
    .where(
      and(
        eq(eveChat.ownerId, ownerId),
        or(eq(eveChat.id, routeId), eq(eveConversation.id, routeId)),
        sql`exists (
          select 1 from "EveConversation" member
          where member."chatId" = ${eveChat.id}
            and member."ownerId" = ${ownerId}
            and member."state" in ('creating', 'bound', 'uncertain')
        )`
      )
    );
  return assigned ?? null;
};
export {
  createProject,
  deleteProject,
  getProjectById,
  getProjectsByUserId,
  updateProject,
  assignEveConversationProject,
  getEveConversationProject,
};
