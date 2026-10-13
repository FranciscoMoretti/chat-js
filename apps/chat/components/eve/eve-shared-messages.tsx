"use client";

import React from "react";

import {
  Conversation,
  ConversationContent,
} from "@/components/ai-elements/conversation";
import type { ReadonlyEveMessage } from "@/lib/eve/readonly-message-types";
import type { ReadonlyReactNode } from "@/lib/readonly-react-node";

import { EveMessages } from "./eve-messages";

export const EveSharedMessages = ({
  messages,
  children,
}: {
  readonly messages: readonly ReadonlyEveMessage[];
  readonly children?: ReadonlyReactNode;
}): React.JSX.Element => (
  <Conversation>
    <ConversationContent className="mx-auto w-full max-w-3xl">
      <EveMessages
        disabled
        isReadonly
        messages={messages}
        respond={() => {
          // Shared transcripts have no interactive input response.
        }}
      />
      {children}
    </ConversationContent>
  </Conversation>
);
