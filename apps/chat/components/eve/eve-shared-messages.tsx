"use client";

import type { EveMessage } from "eve/client";
import React from "react";
import type { ReactNode } from "react";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import {
  Conversation,
  ConversationContent,
} from "@/components/ai-elements/conversation";
/* oxlint-enable sort-imports */

import { EveMessages } from "./eve-messages";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (EveSharedMessages); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable react-perf/jsx-no-new-function-as-prop, typescript/prefer-readonly-parameter-types -- EveSharedMessages: ; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

export const EveSharedMessages = ({
  messages,
  children,
}: {
  messages: readonly EveMessage[];
  children?: ReactNode;
}): React.JSX.Element => (
  <Conversation>
    <ConversationContent
      // oxlint-disable-next-line react/forbid-component-props -- ConversationContent accepts className in its styling contract; preserve this caller's layout and appearance.
      className="mx-auto w-full max-w-3xl"
    >
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
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable react-perf/jsx-no-new-function-as-prop, typescript/prefer-readonly-parameter-types */
