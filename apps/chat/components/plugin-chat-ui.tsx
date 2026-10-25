"use client";
import React from "react";
import { installedChatUi } from "@/composition/generated/installed-chat-ui";
import type { ChatActionProps } from "@/lib/chat-plugin-contracts";

export const PluginSidebar = (): React.JSX.Element => (
  <>
    {installedChatUi.map(({ id, chat: { Sidebar } }) =>
      Sidebar ? <Sidebar key={id} /> : null
    )}
  </>
);
export const PluginChatActions = ({
  chat,
}: ChatActionProps): React.JSX.Element => (
  <>
    {installedChatUi.map(({ id, chat: { Actions } }) =>
      Actions ? <Actions chat={chat} key={id} /> : null
    )}
  </>
);
export const PluginChatBreadcrumb = ({
  chatId,
}: {
  readonly chatId: string;
}): React.JSX.Element => (
  <>
    {installedChatUi.map(({ id, chat: { Breadcrumb } }) =>
      Breadcrumb ? <Breadcrumb chatId={chatId} key={id} /> : null
    )}
  </>
);
