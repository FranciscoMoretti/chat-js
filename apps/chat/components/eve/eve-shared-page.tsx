import { notFound } from "next/navigation";
import { z } from "zod";

import { ChatHeaderView } from "@/components/chat-header-view";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { getPublicEveTranscript } from "@/lib/eve/public-conversation";

import { EveArtifactLayout } from "./eve-artifact-layout";
import { EveSharedBadge } from "./eve-chat-header";
import { EveCopyButton } from "./eve-copy-button";
import { EveSharedMessages } from "./eve-shared-messages";

export const EveSharedPage = async ({ id }: { id: string }) => {
  if (!z.uuid().safeParse(id).success) {
    notFound();
  }
  const conversation = await getPublicEveTranscript(id);
  if (!conversation) {
    notFound();
  }
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
          <EveCopyButton sourceConversationId={conversation.id} />
        </EveSharedMessages>
      </section>
    </EveArtifactLayout>
  );
};
