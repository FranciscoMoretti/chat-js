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
  const { branchId } = chat;
  if (
    branchId === undefined ||
    branchId === null ||
    branchId === "" ||
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
            <EveShareDialogContent branchId={branchId} onClose={onClose} />
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
    chat.branchId === undefined ||
    chat.branchId === null ||
    chat.branchId === "" ||
    chat.state !== "bound"
  ) {
    return null;
  }
  return <EveShareButton branchId={chat.branchId} className="hidden md:flex" />;
};
