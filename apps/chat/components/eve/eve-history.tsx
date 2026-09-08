import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { listEveConversations } from "@/lib/db/eve-queries";
import { getChatsByUserId } from "@/lib/db/queries";
import { EveHistoryList } from "./eve-history-list";

export async function EveHistory() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return null;
  }
  const [current, archived] = await Promise.all([
    listEveConversations(session.user.id),
    getChatsByUserId({ id: session.user.id }),
  ]);
  const items = [
    ...current.map((row) => ({
      id: row.id,
      title: row.firstMessage.slice(0, 100),
      archived: false,
      createdAt: row.createdAt.getTime(),
    })),
    ...archived.map((row) => ({
      id: row.id,
      title: row.title,
      archived: true,
      createdAt: row.createdAt.getTime(),
    })),
  ].sort((a, b) => b.createdAt - a.createdAt);
  return <EveHistoryList items={items} />;
}
