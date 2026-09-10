import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ChatHeaderView } from "@/components/chat-header";
import { getPublicEveTranscript } from "@/lib/eve/public-conversation";
import { EveArtifactLayout } from "./eve-artifact-layout";
import { EveSharedMessages } from "./eve-shared-messages";

export async function EveSharedPage({ id }: { id: string }) {
  if (!z.uuid().safeParse(id).success) {
    notFound();
  }
  const conversation = await getPublicEveTranscript(id);
  if (!conversation) {
    notFound();
  }
  return (
    <EveArtifactLayout conversationId={id} readOnly>
      <section className="flex h-full min-h-0 flex-col">
        <ChatHeaderView
          actions={
            <Link className="text-sm" href="/">
              New conversation
            </Link>
          }
          breadcrumb={
            <h1 className="ml-2 truncate font-medium text-sm">
              {conversation.title}
            </h1>
          }
        />
        <EveSharedMessages messages={conversation.messages} />
      </section>
    </EveArtifactLayout>
  );
}
