import { Suspense } from "react";
import { ChatLoadingShell } from "@/components/chat-loading-shell";
import { EveSharedPage } from "@/components/eve/eve-shared-page";
import { isEveEnabled } from "@/lib/eve/availability";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";
import { SharedChatPage } from "./shared-chat-page";

export default function SharedChatPageRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<ChatLoadingShell />}>
      <SharedChatPageContent params={params} />
    </Suspense>
  );
}

async function SharedChatPageContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (isEveEnabled()) {
    return <EveSharedPage id={(await params).id} />;
  }
  const { id } = await params;

  // Prefetch the queries used in shared-chat-page.tsx
  prefetch(trpc.chat.getPublicChat.queryOptions({ chatId: id }));
  prefetch(trpc.chat.getPublicChatMessages.queryOptions({ chatId: id }));

  return (
    <HydrateClient>
      <SharedChatPage id={id} />
    </HydrateClient>
  );
}
