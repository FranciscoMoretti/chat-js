import { Suspense } from "react";

import { ChatLoadingShell } from "@/components/chat-loading-shell";
import { EveChatPage } from "@/components/eve/eve-chat-page";
import { isEveEnabled } from "@/lib/eve/availability";

const ConversationPage = async ({
  params,
}: {
  params: Promise<{
    id: string;
  }>;
}) => {
  const resolvedResult1 = await params;
  return <EveChatPage conversationId={resolvedResult1.id} />;
};

const ChatPageRoute = ({
  params,
}: {
  params: Promise<{
    id: string;
  }>;
}) => {
  if (!isEveEnabled()) {
    return null;
  }
  return (
    <Suspense fallback={<ChatLoadingShell />}>
      <ConversationPage params={params} />
    </Suspense>
  );
};

export default ChatPageRoute;
