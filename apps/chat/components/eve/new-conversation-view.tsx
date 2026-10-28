"use client";

import React from "react";
import type { ReactNode } from "react";
import type { ComposerSubmission } from "@/components/composer/submission";
import { hasText } from "@/components/text-value";
import { ChatWelcomeView } from "@/components/chat/chat-welcome-view";
import {
  MessageScroller,
  MessageScrollerProvider,
  MessageScrollerViewport,
  MessageScrollerContent,
  MessageScrollerButton,
} from "@/components/ui/message-scroller";

/** Submission owns recovery and optimistic rendering; this view only places them. */
export const NewConversationView = ({
  composer,
  contextual,
  submission,
}: {
  readonly composer: ReactNode;
  readonly contextual: boolean;
  readonly submission: ComposerSubmission;
}): ReactNode => {
  if (submission.recovery !== undefined) {
    return submission.recovery;
  }
  const input = (
    <>
      {composer}
      {hasText(submission.error) && <p role="alert">{submission.error}</p>}
    </>
  );
  if (submission.pending) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <MessageScrollerProvider autoScroll>
          <MessageScroller className="flex-1">
            <MessageScrollerViewport>
              <MessageScrollerContent className="mx-auto w-full max-w-3xl p-4">
                {submission.preview}
                <output className="sr-only">Sending…</output>
              </MessageScrollerContent>
            </MessageScrollerViewport>
            <MessageScrollerButton />
          </MessageScroller>
        </MessageScrollerProvider>
        <div className="mx-auto w-full max-w-3xl p-4">{input}</div>
      </div>
    );
  }
  return contextual ? input : <ChatWelcomeView>{input}</ChatWelcomeView>;
};
