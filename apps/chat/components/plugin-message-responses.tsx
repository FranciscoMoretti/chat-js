"use client";

import React from "react";
import { messageResponses } from "@/message-responses";
import type { ChatMessageProps } from "@/lib/chat-plugin-contracts";

/** Response content has a separate placement from versions and action buttons. */
export const PluginMessageResponses = (
  props: ChatMessageProps
): React.JSX.Element => (
  <>
    {messageResponses.map(({ id, Component }) => (
      <Component key={id} {...props} />
    ))}
  </>
);
