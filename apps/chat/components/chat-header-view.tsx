"use client";

import { HeaderActions } from "@/components/header-actions";

import React from "react";

import type { ReadonlyReactNode } from "@/lib/readonly-react-node";

import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  ChatHeader,
  ChatHeaderLeading,
  ChatHeaderTitle,
} from "./chat/chat-header";

export const ChatHeaderView = ({
  breadcrumb,
  actions,
  className,
  utilities,
}: {
  readonly breadcrumb: ReadonlyReactNode;
  readonly actions?: ReadonlyReactNode;
  readonly className?: string;
  readonly utilities?: ReadonlyReactNode;
}): React.JSX.Element => (
  <ChatHeader className={className}>
    <ChatHeaderLeading>
      <ChatHeaderTitle>
        <SidebarTrigger className="md:hidden" />
        {breadcrumb}
      </ChatHeaderTitle>
      {actions}
    </ChatHeaderLeading>
    {utilities === undefined ? <HeaderActions /> : utilities}
  </ChatHeader>
);
