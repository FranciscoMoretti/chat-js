"use client";
import { memo, useState } from "react";

import type { ChatMessage } from "@/lib/ai/types";
import { useChatId, useMessageById } from "@/lib/stores/base";
import { getAttachmentsFromMessage } from "@/lib/utils";

import { AttachmentList } from "./attachment-list";
import { ImageModal } from "./image-modal";
import { MessageActions } from "./message-actions";
import { MessageEditor } from "./message-editor";
import { ParallelResponseCards } from "./parallel-response-cards";
import { UserMessageView } from "./user-message-view";

export interface BaseMessageProps {
  isLoading: boolean;
  isReadonly: boolean;
  messageId: string;
  parentMessageId: string | null;
}

const PureUserMessage = ({
  messageId,
  isLoading,
  isReadonly,
  parentMessageId,
}: BaseMessageProps) => {
  const chatId = useChatId();
  const message = useMessageById<ChatMessage>(messageId);
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [imageModal, setImageModal] = useState<{
    isOpen: boolean;
    imageUrl: string;
    imageName?: string;
  }>({
    imageUrl: "",
    isOpen: false,
  });

  const handleImageClick = (imageUrl: string, imageName?: string) => {
    setImageModal({
      imageName,
      imageUrl,
      isOpen: true,
    });
  };

  if (!message) {
    return null;
  }
  const textPart = message.parts.find((part) => part.type === "text");
  if (!(textPart && chatId)) {
    return null;
  }

  return (
    <>
      <UserMessageView
        messageId={message.id}
        text={textPart.text}
        onEdit={isReadonly ? undefined : () => setMode("edit")}
        attachments={
          <AttachmentList
            attachments={getAttachmentsFromMessage(message)}
            onImageClick={handleImageClick}
            testId="message-attachments"
          />
        }
        responses={
          <ParallelResponseCards
            isReadonly={isReadonly}
            messageId={message.id}
          />
        }
        editor={
          mode === "edit" ? (
            <MessageEditor
              chatId={chatId}
              key={message.id}
              message={message}
              parentMessageId={parentMessageId}
              setMode={setMode}
            />
          ) : undefined
        }
        actions={
          <MessageActions
            chatId={chatId}
            isEditing={mode === "edit"}
            isLoading={isLoading}
            isReadOnly={isReadonly}
            key={`action-${message.id}`}
            messageId={messageId}
            onCancelEdit={() => setMode("view")}
            onStartEdit={() => setMode("edit")}
          />
        }
      />
      <ImageModal
        imageName={imageModal.imageName}
        imageUrl={imageModal.imageUrl}
        isOpen={imageModal.isOpen}
        onClose={() =>
          setImageModal({
            imageUrl: "",
            isOpen: false,
          })
        }
      />
    </>
  );
};

export const UserMessage = memo(PureUserMessage, (prevProps, nextProps) => {
  if (prevProps.messageId !== nextProps.messageId) {
    return false;
  }
  if (prevProps.isReadonly !== nextProps.isReadonly) {
    return false;
  }
  if (prevProps.parentMessageId !== nextProps.parentMessageId) {
    return false;
  }
  if (prevProps.isLoading !== nextProps.isLoading) {
    return false;
  }
  return true;
});
