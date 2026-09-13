"use client";

import type { EveMessage } from "eve/client";
import type { ReactNode } from "react";

import {
  Conversation,
  ConversationContent,
} from "@/components/ai-elements/conversation";

import { EveMessages } from "./eve-messages";

export function EveSharedMessages({
  messages,
  children,
}: {
  messages: readonly EveMessage[];
  children?: ReactNode;
}) {
  return (
    <Conversation>
      <ConversationContent className="mx-auto w-full max-w-3xl">
        <EveMessages
          disabled
          isReadonly
          messages={messages}
          respond={() => undefined}
        />
        {children}
      </ConversationContent>
    </Conversation>
  );
}
