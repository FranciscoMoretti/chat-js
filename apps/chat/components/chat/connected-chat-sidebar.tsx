"use client";
import type { ComponentProps } from "react";
import { ChatSidebar } from "./chat-sidebar";
import { useAccountControl } from "../sidebar-user-nav";

export const ConnectedChatSidebar = (
  props: Omit<ComponentProps<typeof ChatSidebar>, "account">
) => <ChatSidebar {...props} account={useAccountControl()} />;
