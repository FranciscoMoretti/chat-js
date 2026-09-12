import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { ChatHeaderView } from "@/components/chat-header";
import { auth } from "@/lib/auth";
import { getEveCopyOperation } from "@/lib/db/eve-copy-journal";
import { getEveConversation } from "@/lib/db/eve-queries";
import { getEveResponseGroupForConversation } from "@/lib/db/eve-response-groups";
import type { CreationScope } from "@/lib/eve/pending-create";
import { EveArtifactLayout } from "./eve-artifact-layout";
import { EveComparisonConversation } from "./eve-comparison-conversation";
import { EveConversation } from "./eve-conversation";
import { EveCopyButton } from "./eve-copy-button";
import { EveCreationRecovery } from "./eve-creation-recovery";
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
  let recoveryScope: CreationScope | undefined;
  if (selected?.parentConversationId) {
    recoveryScope = { conversationId: selected.parentConversationId };
  } else if (selected?.initialProjectId) {
    recoveryScope = { projectId: selected.initialProjectId };
  }
  const header = (
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
          {selected?.title ?? selected?.firstMessage.slice(0, 100) ?? "Chat"}
        </h1>
      }
    />
  );
  if (selected?.sessionId && selected.state === "bound") {
    const group = await getEveResponseGroupForConversation(
      session.user.id,
      selected.id
    );
    if (group) {
      return (
        <EveComparisonConversation
          conversationId={selected.id}
          header={header}
          initialGroup={group}
          key={selected.sessionId}
          ownerId={session.user.id}
        />
      );
    }
    return (
      <EveConversation
        conversationId={selected.id}
        header={header}
        key={selected.sessionId}
        ownerId={session.user.id}
        sessionId={selected.sessionId}
      />
    );
  }
  const copy =
    selected?.creationKind === "copy"
      ? await getEveCopyOperation(session.user.id, selected.operationId)
      : undefined;
  let content = (
    <NewEveConversation key={session.user.id} ownerId={session.user.id} />
  );
  if (selected) {
    content = (
      <EveCreationRecovery
        firstMessage={selected.firstMessage}
        key={selected.id}
        operationId={selected.operationId}
        ownerId={session.user.id}
        scope={recoveryScope}
      />
    );
  }
  if (copy && selected?.initialModelId) {
    content = (
      <EveCopyButton
        recovery={{
          sourceConversationId: copy.copy.sourceConversationId,
          operationId: selected.operationId,
          modelId: selected.initialModelId,
        }}
        sourceConversationId={copy.copy.sourceConversationId}
      />
    );
  }
  return (
    <EveArtifactLayout conversationId={conversationId}>
      <section className="flex h-full min-h-0 flex-col">
        {header}
        {content}
      </section>
    </EveArtifactLayout>
  );
}
