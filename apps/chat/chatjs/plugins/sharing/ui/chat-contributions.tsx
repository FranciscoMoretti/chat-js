"use client";
import React, { useState } from "react";
import type { ChatActionProps } from "@/chatjs/core/chat/contracts";
import { EveShareButton, EveShareDialogContent } from "./share-dialog";
import { ShareDialog } from "./share-button";
import { ShareMenuItem } from "./share-menu-item";

export const SharingActions = ({
  chat,
}: ChatActionProps): React.JSX.Element | null => {
  const [open, setOpen] = useState(false);
  const { conversationId } = chat;
  if (
    conversationId === undefined ||
    conversationId === null ||
    conversationId === "" ||
    chat.state !== "bound"
  ) {
    return null;
  }
  return (
    <>
      <ShareMenuItem
        onShare={() => {
          setOpen(true);
        }}
      />
      {open && (
        <ShareDialog
          open={open}
          onOpenChange={setOpen}
          renderContent={(onClose) => (
            <EveShareDialogContent chatId={conversationId} onClose={onClose} />
          )}
        />
      )}
    </>
  );
};
export const SharingHeaderActions = ({
  chat,
}: ChatActionProps): React.JSX.Element | null => {
  if (
    chat.conversationId === undefined ||
    chat.conversationId === null ||
    chat.conversationId === "" ||
    chat.state !== "bound"
  ) {
    return null;
  }
  return (
    <EveShareButton chatId={chat.conversationId} className="hidden md:flex" />
  );
};
