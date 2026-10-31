import { headers } from "next/headers";
import { resolveEvePrincipal } from "@/lib/eve/principal";
import { notFound } from "next/navigation";
import React from "react";
import type { JSX as ReactJSX } from "react";
import { z } from "zod";

import { ChatHeaderView } from "@/components/chat-header-view";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { getPublicEveTranscript } from "@/chatjs/plugins/sharing/public-conversation";

import { EveArtifactLayout } from "@/components/eve/eve-artifact-layout";
import { EveSharedBadge } from "./shared-badge";
import { EveCopyButton } from "@/components/eve/eve-copy-button";
import { EveSharedMessages } from "./transcript-messages";

export const EveSharedPage = async ({
  id,
}: {
  readonly id: string;
}): Promise<ReactJSX.Element> => {
  if (!z.uuid().safeParse(id).success) {
    notFound();
  }
  const conversation = await getPublicEveTranscript(id);
  if (!conversation) {
    notFound();
  }
  const principal = await resolveEvePrincipal(await headers());
  return (
    <EveArtifactLayout
      conversationId={id}
      messages={conversation.messages}
      readOnly
    >
      <section className="flex h-full min-h-0 flex-col">
        <ChatHeaderView
          actions={<EveSharedBadge />}
          breadcrumb={
            <Breadcrumb className="ml-2 min-w-0">
              <BreadcrumbList className="flex-nowrap">
                <BreadcrumbItem className="min-w-0">
                  <BreadcrumbPage className="truncate">
                    {conversation.title}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          }
        />
        <EveSharedMessages messages={conversation.messages}>
          {principal?.ownerId === conversation.ownerId ? (
            <EveCopyButton sourceConversationId={conversation.id} />
          ) : (
            <p className="text-muted-foreground p-4 text-sm">
              Shared conversations are read-only. Workspace access is private to
              the owner.
            </p>
          )}
        </EveSharedMessages>
      </section>
    </EveArtifactLayout>
  );
};
