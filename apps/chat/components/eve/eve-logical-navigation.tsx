"use client";

import React from "react";
import type { JSX as ReactJSX } from "react";
import { MessageSiblingsView } from "@/components/message-siblings-view";
import { useLogicalChat } from "./eve-logical-context";

export const EveLogicalVersions = ({
  conversationId,
  messageId,
  disabled,
}: {
  readonly conversationId: string;
  readonly messageId: string;
  readonly disabled: boolean;
}): ReactJSX.Element => {
  const { controller } = useLogicalChat();
  const { ids, index } = controller.siblings(conversationId, messageId);
  const select = (offset: number): void => {
    const id = ids[index + offset];
    if (!disabled && id) {
      controller.selectNode(id);
    }
  };
  return (
    <MessageSiblingsView
      count={ids.length}
      index={Math.max(0, index)}
      disabled={disabled}
      onNext={() => {
        select(1);
      }}
      onPrevious={() => {
        select(-1);
      }}
    />
  );
};
