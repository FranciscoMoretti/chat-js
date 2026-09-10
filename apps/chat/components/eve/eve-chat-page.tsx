import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { ChatHeaderView } from "@/components/chat-header";
import { auth } from "@/lib/auth";
import { getEveConversation } from "@/lib/db/eve-queries";
import { EveArtifactLayout } from "./eve-artifact-layout";
import { EveConversation } from "./eve-conversation";
import { EveShareButton } from "./eve-share-dialog";
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
    <EveArtifactLayout conversationId={conversationId}>
      <section className="flex h-full min-h-0 flex-col">
        <ChatHeaderView
          actions={
            <>
              {selected?.sessionId && <EveShareButton chatId={selected.id} />}
              <Link className="text-sm" href="/">
                New conversation
              </Link>
            </>
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
            conversationId={selected.id}
            key={selected.sessionId}
            ownerId={session.user.id}
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
    </EveArtifactLayout>
  );
}
