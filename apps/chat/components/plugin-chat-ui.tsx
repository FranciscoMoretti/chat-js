"use client";
import React from "react";
import { SidebarMenuItem } from "@/components/ui/sidebar";
import { installedChatUi } from "@/composition/generated/installed-chat-ui";
import { chatUiPlacement, customChatUi } from "@/composition/custom/chat-ui";
import { composeContributions } from "@/lib/compose-contributions";
import type {
  ChatClientIntegration,
  ChatActionProps,
  ChatSuggestionsProps,
  ChatMessageActionProps,
} from "@/lib/chat-plugin-contracts";

const contributions = (slot: keyof ChatClientIntegration) =>
  composeContributions(
    installedChatUi,
    customChatUi.map((entry) => ({
      id: entry.id,
      chat: {
        ...installedChatUi.find((installed) => installed.id === entry.id)?.chat,
        ...entry.chat,
      },
    })),
    chatUiPlacement[slot]
  );

export const PluginSidebar = (): React.JSX.Element => (
  <>
    {contributions("Sidebar").map(({ id, chat: { Sidebar } }) =>
      Sidebar ? <Sidebar key={id} /> : null
    )}
  </>
);
export const PluginChatActions = ({
  chat,
}: ChatActionProps): React.JSX.Element => (
  <>
    {contributions("Actions").map(({ id, chat: { Actions } }) =>
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
    {contributions("Breadcrumb").map(({ id, chat: { Breadcrumb } }) =>
      Breadcrumb ? <Breadcrumb chatId={chatId} key={id} /> : null
    )}
  </>
);

export const PluginMessageActions = (
  props: ChatMessageActionProps
): React.JSX.Element => (
  <>
    {contributions("MessageActions").map(({ id, chat: { MessageActions } }) =>
      MessageActions ? <MessageActions key={id} {...props} /> : null
    )}
  </>
);

export const PluginSuggestions = (
  props: ChatSuggestionsProps
): React.JSX.Element => (
  <>
    {contributions("Suggestions").map(({ id, chat: { Suggestions } }) =>
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
    {contributions("SidebarHeader").map(({ id, chat: { SidebarHeader } }) =>
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
    {contributions("HeaderActions").map(({ id, chat: { HeaderActions } }) =>
      HeaderActions ? <HeaderActions key={id} chat={chat} /> : null
    )}
  </>
);
