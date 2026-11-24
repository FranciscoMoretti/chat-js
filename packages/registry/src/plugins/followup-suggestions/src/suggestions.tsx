"use client";

import React from "react";
import type { ChatSuggestionsProps } from "@/chatjs/core/chat/contracts";
import { useEveFollowups } from "./use-followups";
import { FollowUpSuggestionsView } from "./followup-suggestions-view";

export const FollowupSuggestions = ({
  branchId,
  sessionId,
  events,
  lastMessage,
  onSelect,
  disabled,
}: ChatSuggestionsProps): React.JSX.Element | null => {
  const suggestions = useEveFollowups(branchId, sessionId, events, lastMessage);
  return (
    <FollowUpSuggestionsView
      suggestions={suggestions}
      onSelect={onSelect}
      disabled={disabled}
    />
  );
};
