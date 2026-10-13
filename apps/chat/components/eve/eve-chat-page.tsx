import { hasText } from "@/components/text-value";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import React from "react";
import type { JSX as ReactJSX } from "react";
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

const creationRecoveryScope = (
  selected: Awaited<ReturnType<typeof getEveChatPageConversation>> | undefined
): CreationScope | undefined => {
  if (hasText(selected?.parentConversationId)) {
    return { conversationId: selected.parentConversationId };
  }
  if (hasText(selected?.initialProjectId)) {
    return { projectId: selected.initialProjectId };
  }
  return undefined;
};

export const EveChatPage = async ({
  conversationId,
}: {
  readonly conversationId?: string;
}): Promise<ReactJSX.Element> => {
  const principal = await resolveEvePrincipal(await headers());
  if (!principal) {
    if (hasText(conversationId)) {
      redirect("/");
    }
    return <DisposableGuestChat />;
  }
  if (hasText(conversationId) && !z.uuid().safeParse(conversationId).success) {
    notFound();
  }
  const selected = hasText(conversationId)
    ? await getEveChatPageConversation(principal.ownerId, conversationId)
    : undefined;
  if (hasText(conversationId) && !selected) {
    notFound();
  }
  const recoveryScope = creationRecoveryScope(selected);
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
  if (hasText(selected?.sessionId) && selected.state === "bound") {
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
  if (copy && hasText(selected?.initialModelId)) {
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
