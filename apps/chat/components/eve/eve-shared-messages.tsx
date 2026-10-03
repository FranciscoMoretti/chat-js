"use client";

import type { EveMessage } from "eve/client";
import React from "react";
import type { ReactNode } from "react";

import {
  Conversation,
  ConversationContent,
} from "@/components/ai-elements/conversation";

import { EveMessages } from "./eve-messages";
/* oxlint-disable react-perf/jsx-no-new-function-as-prop, typescript/prefer-readonly-parameter-types -- EveSharedMessages: ; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

export const EveSharedMessages = ({
  messages,
  children,
}: {
  messages: readonly EveMessage[];
  children?: ReactNode;
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
/* oxlint-enable react-perf/jsx-no-new-function-as-prop, typescript/prefer-readonly-parameter-types */
