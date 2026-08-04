import { Suspense } from "react";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";
import { SharedChatPage } from "./shared-chat-page";

export default function SharedChatPageRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<div className="h-dvh w-full bg-background" />}>
      <SharedChatPageContent params={params} />
    </Suspense>
  );
}

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
