import { headers } from "next/headers";
import { listEveConversations } from "@/lib/db/eve-queries";
import { resolveEvePrincipal } from "@/lib/eve/principal";
import { EveHistoryList } from "./eve-history-list";

export async function EveHistory() {
  const principal = await resolveEvePrincipal(await headers());
  if (!principal) {
    return null;
  }
  const current = await listEveConversations(principal.ownerId);
  return (
    <EveHistoryList
      initialPage={current}
      key={principal.ownerId}
      ownerId={principal.ownerId}
    />
  );
}
