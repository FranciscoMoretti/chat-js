import { Suspense } from "react";

import { ChatLoadingShell } from "@/components/chat-loading-shell";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

import { SharedChatPage } from "./shared-chat-page";

const SharedChatPageRoute = ({
  params,
}: {
  params: Promise<{ id: string }>;
}) => (
  <Suspense fallback={<ChatLoadingShell />}>
    <SharedChatPageContent params={params} />
  </Suspense>
);

export default SharedChatPageRoute;

async function SharedChatPageContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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
