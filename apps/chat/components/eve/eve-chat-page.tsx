import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { ChatHeaderView } from "@/components/chat-header";
import { getEveCopyOperation } from "@/lib/db/eve-copy-journal";
import { getEveConversation } from "@/lib/db/eve-queries";
import { getEveResponseGroupForConversation } from "@/lib/db/eve-response-groups";
import type { CreationScope } from "@/lib/eve/pending-create";
import { resolveEvePrincipal } from "@/lib/eve/principal";

import { EveArtifactLayout } from "./eve-artifact-layout";
import { EveComparisonConversation } from "./eve-comparison-conversation";
import { EveConversation } from "./eve-conversation";
import { EveCopyButton } from "./eve-copy-button";
import { EveCreationRecovery } from "./eve-creation-recovery";
import { EveGuestBootstrap } from "./eve-guest-bootstrap";
import { EveShareButton } from "./eve-share-dialog";
import { NewEveConversation } from "./new-eve-conversation";

// This server boundary selects the authenticated, recovery, comparison, and chat states.
// oxlint-disable-next-line eslint/complexity
export const EveChatPage = async ({
  conversationId,
}: {
  conversationId?: string;
}) => {
  const principal = await resolveEvePrincipal(await headers());
  if (!principal) {
    return <EveGuestBootstrap />;
  }
  if (conversationId && !z.uuid().safeParse(conversationId).success) {
    notFound();
  }
  const selected = conversationId
    ? await getEveConversation(principal.ownerId, conversationId)
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
          {principal.kind === "registered" && selected?.sessionId && (
            <EveShareButton chatId={selected.id} />
          )}
          <Link className="text-sm" href="/">
            New conversation
          </Link>
        </>
      }
      breadcrumb={
        <h1 className="ml-2 truncate text-sm font-medium">
          {selected?.title ?? selected?.firstMessage.slice(0, 100) ?? "Chat"}
        </h1>
      }
    />
  );
  if (selected?.sessionId && selected.state === "bound") {
    const group = await getEveResponseGroupForConversation(
      principal.ownerId,
      selected.id
    );
    if (group) {
      return (
        <EveComparisonConversation
          conversationId={selected.id}
          header={header}
          initialGroup={group}
          key={selected.sessionId}
          ownerId={principal.ownerId}
        />
      );
    }
    return (
      <EveConversation
        conversationId={selected.id}
        header={header}
        key={selected.sessionId}
        ownerId={principal.ownerId}
        sessionId={selected.sessionId}
      />
    );
  }
  const copy =
    selected?.creationKind === "copy"
      ? await getEveCopyOperation(principal.ownerId, selected.operationId)
      : undefined;
  let content = (
    <NewEveConversation key={principal.ownerId} ownerId={principal.ownerId} />
  );
  if (selected) {
    content = (
      <EveCreationRecovery
        firstMessage={selected.firstMessage}
        key={selected.id}
        operationId={selected.operationId}
        ownerId={principal.ownerId}
        scope={recoveryScope}
      />
    );
  }
  if (copy && selected?.initialModelId) {
    content = (
      <EveCopyButton
        recovery={{
          modelId: selected.initialModelId,
          operationId: selected.operationId,
          sourceConversationId: copy.copy.sourceConversationId,
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
};
