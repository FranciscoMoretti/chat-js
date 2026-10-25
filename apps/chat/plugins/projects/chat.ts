import type { SQL } from "drizzle-orm";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { eveChat } from "@/lib/db/schema";
import type {
  ChatServerIntegration,
  ChatLinks,
} from "@/lib/chat-plugin-contracts";
import { eveChatProject } from "./db/project-schema";
import { assignCreationProject } from "./creation";

export const projectsChat = {
  onCreate: assignCreationProject,
  historyFilter: (
    { projectId }: { readonly projectId?: string | null },
    surface: "sidebar" | "all"
  ): SQL | undefined => {
    if (projectId === undefined && surface === "all") {
      return undefined;
    }
    const membership = sql`select 1 from ${eveChatProject} where ${eveChatProject.chatId} = ${eveChat.id} and ${eveChatProject.ownerId} = ${eveChat.ownerId}`;
    return typeof projectId === "string"
      ? sql`exists (${membership} and ${eveChatProject.projectId} = ${projectId})`
      : sql`not exists (${membership})`;
  },
  links: async (
    ownerId: string,
    chatIds: readonly string[]
  ): Promise<ReadonlyMap<string, ChatLinks>> => {
    if (chatIds.length === 0) {
      return new Map();
    }
    const rows = await db
      .select()
      .from(eveChatProject)
      .where(
        and(
          eq(eveChatProject.ownerId, ownerId),
          inArray(eveChatProject.chatId, [...chatIds])
        )
      );
    return new Map(
      rows.map((row) => [
        row.chatId,
        {
          href: `/project/${row.projectId}/chat/${row.chatId}`,
          parentHref: `/project/${row.projectId}`,
        },
      ])
    );
  },
  onDelete: async (tx, chatId) => {
    await tx.delete(eveChatProject).where(eq(eveChatProject.chatId, chatId));
  },
} satisfies ChatServerIntegration;
