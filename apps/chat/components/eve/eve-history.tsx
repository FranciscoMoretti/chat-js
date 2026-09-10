import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { listEveConversations } from "@/lib/db/eve-queries";
import { EveHistoryList } from "./eve-history-list";

export async function EveHistory() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return null;
  }
  const current = await listEveConversations(session.user.id);
  const items = current.map((row) => ({
    id: row.id,
    title: row.firstMessage.slice(0, 100),
  }));
  return <EveHistoryList items={items} />;
}
