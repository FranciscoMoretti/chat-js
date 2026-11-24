import React, { Suspense } from "react";

import { ChatLoadingShell } from "@/components/chat-loading-shell";
import { EveChatPage } from "@/components/eve/eve-chat-page";

const ConversationPage = async ({
  params,
}: {
  readonly params: Readonly<
    Promise<{
      readonly chatId: string;
    }>
  >;
}): Promise<React.JSX.Element> => {
  const { chatId } = await params;
  return <EveChatPage chatId={chatId} />;
};

const ChatPageRoute = ({
  params,
}: {
  readonly params: Readonly<
    Promise<{
      readonly chatId: string;
    }>
  >;
}): React.JSX.Element => (
  <Suspense fallback={<ChatLoadingShell />}>
    <ConversationPage params={params} />
  </Suspense>
);
export default ChatPageRoute;
