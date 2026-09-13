import { Suspense } from "react";

import { ChatLoadingShell } from "@/components/chat-loading-shell";
import { EveSharedPage } from "@/components/eve/eve-shared-page";
import { isEveEnabled } from "@/lib/eve/availability";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

import { SharedChatPage } from "./shared-chat-page";

const SharedChatPageContent = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}) => {
  if (isEveEnabled()) {
    const resolvedResult1 = await params;
    return <EveSharedPage id={resolvedResult1.id} />;
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
};

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
