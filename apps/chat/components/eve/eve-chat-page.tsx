import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { auth } from "@/lib/auth";
import { getEveConversation } from "@/lib/db/eve-queries";
import { getAllMessagesByChatId, getChatById } from "@/lib/db/queries";
import { dbChatToUIChat } from "@/lib/message-conversion";
import { ArchivedConversation } from "./archived-conversation";
import { EveConversation } from "./eve-conversation";
import { NewEveConversation } from "./new-eve-conversation";

export async function EveChatPage({
  conversationId,
}: {
  conversationId?: string;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    redirect("/login");
  }
  if (conversationId && !z.uuid().safeParse(conversationId).success) {
    notFound();
  }
  const selected = conversationId
    ? await getEveConversation(session.user.id, conversationId)
    : undefined;
  if (conversationId && !selected) {
    const previous = await getChatById({ id: conversationId });
    if (!previous || previous.userId !== session.user.id) {
      notFound();
    }
    return (
      <ArchivedConversation
        chat={dbChatToUIChat(previous)}
        key={previous.id}
        messages={await getAllMessagesByChatId({ chatId: conversationId })}
      />
    );
  }
  return (
    <section className="flex h-dvh min-h-0 flex-col">
      <header className="flex items-center gap-3 border-b p-3">
        <SidebarTrigger />
        <h1 className="font-semibold">Chat</h1>
        <Link className="ml-auto text-sm underline" href="/">
          New conversation
        </Link>
      </header>
      {selected?.sessionId && selected.state === "bound" && (
        <EveConversation
          key={selected.sessionId}
          sessionId={selected.sessionId}
        />
      )}
      {selected && !(selected.sessionId && selected.state === "bound") && (
        <p className="p-4" role="alert">
          Creation is unresolved. Keep conversation {selected.id} for
          reconciliation before retrying.
        </p>
      )}
      {!selected && (
        <NewEveConversation key={session.user.id} ownerId={session.user.id} />
      )}
    </section>
  );
}
