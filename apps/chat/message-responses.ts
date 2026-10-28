"use client";

import type { ComponentType } from "react";
import { installedChatUi } from "@/composition/generated/installed-chat-ui";
import { ParallelResponses } from "@/components/parallel-responses/responses";
import type { ChatMessageProps } from "@/lib/chat-plugin-contracts";

/** App-owned ordering of installed and local response content. */
export const messageResponses: readonly {
  readonly id: string;
  readonly Component: ComponentType<ChatMessageProps>;
}[] = [
  ...installedChatUi.flatMap(({ id, chat: { MessageResponses } }) =>
    MessageResponses ? [{ id, Component: MessageResponses }] : []
  ),
  // Remains local until the response-group runtime is extracted as a plugin.
  { id: "parallel-responses", Component: ParallelResponses },
];
