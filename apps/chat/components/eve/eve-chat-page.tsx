import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import { ChatHeaderView } from "@/components/chat-header-view";
import { getEveCopyOperation } from "@/lib/db/eve-copy-journal";
import { getEveChatPageConversation } from "@/lib/db/eve-queries";
import type { CreationScope } from "@/lib/eve/pending-create";
import { resolveEvePrincipal } from "@/lib/eve/principal";

import { DisposableGuestChat } from "./disposable-guest-chat";
import { EveArtifactLayout } from "./eve-artifact-layout";
import { EveCopyButton } from "./eve-copy-button";
import { EveCreationRecovery } from "./eve-creation-recovery";
import { EveRuntimeRoute } from "./eve-runtime-provider";
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
    if (conversationId) {
      redirect("/");
    }
    return <DisposableGuestChat />;
  }
  if (conversationId && !z.uuid().safeParse(conversationId).success) {
    notFound();
  }
  const selected = conversationId
    ? await getEveChatPageConversation(principal.ownerId, conversationId)
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
      breadcrumb={
        selected ? (
          <h1 className="ml-2 truncate text-sm font-medium">
            {selected.title ?? selected.firstMessage.slice(0, 100)}
          </h1>
        ) : null
      }
    />
  );
  if (selected?.sessionId && selected.state === "bound") {
    return (
      <EveRuntimeRoute
        id={selected.id}
        chatId={selected.chatId}
        sessionId={selected.sessionId}
        ownerId={principal.ownerId}
        title={selected.title}
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
