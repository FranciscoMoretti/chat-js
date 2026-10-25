import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { CreationRejectedError } from "@/lib/creation-rejected-error";
import type { ChatServerIntegration } from "@/lib/chat-plugin-contracts";
import { project, eveChatProject } from "./db/project-schema";

export const assignCreationProject: NonNullable<
  ChatServerIntegration["onCreate"]
> = async ({ tx, chatId, ownerId, request }) => {
  const { projectId } = z
    .object({ projectId: z.uuid().optional() })
    .parse(request ?? {});
  if (projectId === undefined) {
    return;
  }
  const [target] = await tx
    .select({ id: project.id })
    .from(project)
    .where(and(eq(project.id, projectId), eq(project.userId, ownerId)))
    .for("key share");
  if (target === undefined) {
    throw new CreationRejectedError(
      "Project not found.",
      "project_not_found",
      404
    );
  }
  await tx
    .insert(eveChatProject)
    .values({ chatId, ownerId, projectId })
    .onConflictDoNothing();
};
