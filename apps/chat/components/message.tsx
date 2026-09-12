"use client";
import { memo } from "react";

import { useMessageRoleById } from "@/lib/stores/hooks-base";

import { AssistantMessage } from "./assistant-message";
import { UserMessage } from "./user-message";
import type { BaseMessageProps } from "./user-message";

const PurePreviewMessage = ({
  messageId,
  isLoading,
  isReadonly,
  parentMessageId,
}: BaseMessageProps) => {
  const role = useMessageRoleById(messageId);
  if (!role) {
    return null;
  }

  return role === "user" ? (
    <UserMessage
      isLoading={isLoading}
      isReadonly={isReadonly}
      messageId={messageId}
      parentMessageId={parentMessageId}
    />
  ) : (
    <AssistantMessage
      isLoading={isLoading}
      isReadonly={isReadonly}
      messageId={messageId}
    />
  );
};

export const PreviewMessage = memo(
  PurePreviewMessage,
  (prevProps, nextProps) => {
    if (prevProps.isLoading !== nextProps.isLoading) {
      return false;
    }
    if (prevProps.messageId !== nextProps.messageId) {
      return false;
    }
    if (prevProps.parentMessageId !== nextProps.parentMessageId) {
      return false;
    }

    return true;
  }
);
