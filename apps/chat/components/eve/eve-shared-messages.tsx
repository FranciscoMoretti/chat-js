"use client";
/* oxlint-disable sort-imports -- Oxfmt owns this module's external, type-only, and alias import groups; its case-insensitive order conflicts with this declaration-order rule. */

import type { EveMessage } from "eve/client";
import React from "react";
import type { ReactNode } from "react";

import {
  Conversation,
  ConversationContent,
} from "@/components/ai-elements/conversation";

import { EveMessages } from "./eve-messages";
/* oxlint-enable sort-imports */
/* oxlint-disable import/no-named-export, import/prefer-default-export, react-perf/jsx-no-new-function-as-prop, react/forbid-component-props, typescript/prefer-readonly-parameter-types -- EveSharedMessages: import/no-named-export: existing callers import this public component, type, or hook by name; import/prefer-default-export: the existing named import remains stable when this module adds another public declaration; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

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
/* oxlint-enable import/no-named-export, import/prefer-default-export, react-perf/jsx-no-new-function-as-prop, react/forbid-component-props, typescript/prefer-readonly-parameter-types */
