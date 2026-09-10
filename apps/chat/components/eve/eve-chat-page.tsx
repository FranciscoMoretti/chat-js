import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { ChatLayout, ChatLayoutMain } from "@/components/chat/chat-layout";
import { ChatHeaderView } from "@/components/chat-header";
import { auth } from "@/lib/auth";
import { getEveConversation } from "@/lib/db/eve-queries";
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
    notFound();
  }
  return (
    <ChatLayout>
      <ChatLayoutMain defaultSize={100}>
        <section className="flex h-full min-h-0 flex-col">
          <ChatHeaderView
            actions={
              <Link className="text-sm" href="/">
                New conversation
              </Link>
            }
            breadcrumb={
              <h1 className="ml-2 truncate font-medium text-sm">
                {selected?.title ??
                  selected?.firstMessage.slice(0, 100) ??
                  "Chat"}
              </h1>
            }
          />
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
            <NewEveConversation
              key={session.user.id}
              ownerId={session.user.id}
            />
          )}
        </section>
      </ChatLayoutMain>
    </ChatLayout>
  );
}
