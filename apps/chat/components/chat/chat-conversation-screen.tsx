"use client";

import type { ComponentProps, ReactNode } from "react";
import { ChatWelcomeView } from "./chat-welcome-view";
import { ChatTranscript } from "./chat-transcript";
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

/** One transcript and placement contract. Runtime-owned recovery and composer
 * controllers occupy fixed slots; callers cannot replace message rendering. */
export const ChatConversationScreen = ({
  conversationId,
  welcome = false,
  header,
  transcript,
  status,
  composer,
  notices,
  leading,
  trailing,
}: {
  readonly conversationId: string;
  readonly welcome?: boolean;
  readonly header?: ReactNode;
  readonly transcript: ComponentProps<typeof ChatTranscript>;
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
        <MessageScrollerProvider autoScroll key={conversationId}>
          <MessageScroller className="flex-1">
            <MessageScrollerViewport preserveScrollOnPrepend>
              <MessageScrollerContent className="mx-auto w-full max-w-3xl p-4">
                {leading}
                <ChatTranscript {...transcript} />
                <EveThinkingMessage
                  messages={transcript.messages}
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
