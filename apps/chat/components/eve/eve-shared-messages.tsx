"use client";

import React from "react";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import {
  Conversation,
  ConversationContent,
} from "@/components/ai-elements/conversation";
import type { ReadonlyEveMessage } from "@/lib/eve/readonly-message-types";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- These type-only reader imports extend the existing runtime import groups; preserve module evaluation order and the formatter grouping. */
import type { ReadonlyReactNode } from "@/lib/readonly-react-node";

import { EveMessages } from "./eve-messages";
/* oxlint-enable sort-imports */

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (EveSharedMessages); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable react-perf/jsx-no-new-function-as-prop -- EveSharedMessages: ; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract */

export const EveSharedMessages = ({
  messages,
  children,
}: {
  readonly messages: readonly ReadonlyEveMessage[];
  readonly children?: ReadonlyReactNode;
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
/* oxlint-enable react-perf/jsx-no-new-function-as-prop */
