import { Suspense } from "react";
import { ChatLoadingShell } from "@/components/chat-loading-shell";
import { EveChatPage } from "@/components/eve/eve-chat-page";
import { isEveEnabled } from "@/lib/eve/availability";

export default function ChatPageRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!isEveEnabled()) {
    return null;
  }
  return (
    <Suspense fallback={<ChatLoadingShell />}>
      <ConversationPage params={params} />
    </Suspense>
  );
}
async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <EveChatPage conversationId={(await params).id} />;
}
