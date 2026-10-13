import React, { Suspense } from "react";

import { ChatLoadingShell } from "@/components/chat-loading-shell";
import { EveChatPage } from "@/components/eve/eve-chat-page";

const ConversationPage = async ({
  params,
}: {
  readonly params: Readonly<
    Promise<{
      readonly id: string;
    }>
  >;
}): Promise<React.JSX.Element> => {
  const resolvedResult1 = await params;
  return <EveChatPage conversationId={resolvedResult1.id} />;
};

const ChatPageRoute = ({
  params,
}: {
  readonly params: Readonly<
    Promise<{
      readonly id: string;
    }>
  >;
}): React.JSX.Element => (
  <Suspense fallback={<ChatLoadingShell />}>
    <ConversationPage params={params} />
  </Suspense>
);
export default ChatPageRoute;
