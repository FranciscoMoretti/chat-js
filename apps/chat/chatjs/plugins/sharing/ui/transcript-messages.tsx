"use client";

import React from "react";

import {
  MessageScroller,
  MessageScrollerProvider,
  MessageScrollerViewport,
  MessageScrollerContent,
  MessageScrollerButton,
} from "@/components/ui/message-scroller";
import type { ReadonlyEveMessage } from "@/lib/eve/readonly-message-types";
import type { ReadonlyReactNode } from "@/lib/readonly-react-node";

import { EveMessages } from "@/components/eve/eve-messages";

export const EveSharedMessages = ({
  messages,
  children,
}: {
  readonly messages: readonly ReadonlyEveMessage[];
  readonly children?: ReadonlyReactNode;
}): React.JSX.Element => (
  <MessageScrollerProvider autoScroll>
    <MessageScroller className="flex-1">
      <MessageScrollerViewport>
        <MessageScrollerContent className="mx-auto w-full max-w-3xl p-4">
          <EveMessages
            disabled
            isReadonly
            messages={messages}
            respond={() => {
              // Shared transcripts have no interactive input response.
            }}
          />
          {children}
        </MessageScrollerContent>
      </MessageScrollerViewport>
      <MessageScrollerButton />
    </MessageScroller>
  </MessageScrollerProvider>
);
