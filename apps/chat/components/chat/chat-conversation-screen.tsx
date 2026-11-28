"use client";

import type { ComponentProps, ReactNode } from "react";
import { ChatWelcomeView } from "./chat-welcome-view";
import { ChatMessageList } from "./chat-message-list";
import {
  ChatConversation,
  ChatConversationBody,
  ChatConversationFooter,
} from "./chat-conversation";
import { EveThinkingMessage } from "../eve/eve-thinking-message";
import {
  MessageScroller,
  MessageScrollerProvider,
  MessageScrollerViewport,
  MessageScrollerContent,
  MessageScrollerButton,
} from "@/components/ui/message-scroller";

/** Shared message-list layout. Runtime-owned recovery and composer
 * controllers occupy fixed slots; callers cannot replace message rendering. */
export const ChatConversationScreen = ({
  branchId,
  welcome = false,
  header,
  messageList,
  status,
  composer,
  notices,
  leading,
  trailing,
}: {
  readonly branchId: string;
  readonly welcome?: boolean;
  readonly header?: ReactNode;
  readonly messageList: ComponentProps<typeof ChatMessageList>;
  readonly status: string;
  readonly composer: ReactNode;
  readonly notices?: ReactNode;
  readonly leading?: ReactNode;
  readonly trailing?: ReactNode;
}) => (
  <ChatConversation>
    {header}
    {welcome ? (
      <ChatWelcomeView>
        {composer}
        {notices}
      </ChatWelcomeView>
    ) : (
      <ChatConversationBody>
        <MessageScrollerProvider autoScroll key={branchId}>
          <MessageScroller className="flex-1">
            <MessageScrollerViewport preserveScrollOnPrepend>
              <MessageScrollerContent className="mx-auto w-full max-w-3xl p-4">
                {leading}
                <ChatMessageList {...messageList} />
                <EveThinkingMessage
                  messages={messageList.messages}
                  status={status}
                />
                {trailing}
              </MessageScrollerContent>
            </MessageScrollerViewport>
            <MessageScrollerButton />
          </MessageScroller>
        </MessageScrollerProvider>
        <ChatConversationFooter>
          {notices}
          {composer}
        </ChatConversationFooter>
      </ChatConversationBody>
    )}
  </ChatConversation>
);
