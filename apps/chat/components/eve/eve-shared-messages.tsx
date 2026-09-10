"use client";

import type { EveMessage } from "eve/client";
import {
  Conversation,
  ConversationContent,
} from "@/components/ai-elements/conversation";
import { EveMessages } from "./eve-messages";

export function EveSharedMessages({
  messages,
}: {
  messages: readonly EveMessage[];
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
      </ConversationContent>
    </Conversation>
  );
}
