"use client";
import React from "react";
import { SidebarMenuItem } from "@/components/ui/sidebar";
import { installedChatUi } from "@/composition/generated/installed-chat-ui";
import type {
  ChatActionProps,
  ChatSuggestionsProps,
  ChatMessageProps,
} from "@/lib/chat-plugin-contracts";

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

export const PluginMessageActions = (
  props: ChatMessageProps
): React.JSX.Element => (
  <>
    {installedChatUi.map(({ id, chat: { MessageActions } }) =>
      MessageActions ? <MessageActions key={id} {...props} /> : null
    )}
  </>
);

export const PluginSuggestions = (
  props: ChatSuggestionsProps
): React.JSX.Element => (
  <>
    {installedChatUi.map(({ id, chat: { Suggestions } }) =>
      Suggestions ? <Suggestions key={id} {...props} /> : null
    )}
  </>
);

export const PluginSidebarHeader = ({
  ownerId,
}: {
  readonly ownerId?: string;
}): React.JSX.Element => (
  <>
    {installedChatUi.map(({ id, chat: { SidebarHeader } }) =>
      SidebarHeader ? (
        <SidebarMenuItem key={id}>
          <SidebarHeader key={ownerId ?? "anonymous"} ownerId={ownerId} />
        </SidebarMenuItem>
      ) : null
    )}
  </>
);

export const PluginChatHeaderActions = ({
  chat,
}: ChatActionProps): React.JSX.Element => (
  <>
    {installedChatUi.map(({ id, chat: { HeaderActions } }) =>
      HeaderActions ? <HeaderActions key={id} chat={chat} /> : null
    )}
  </>
);
