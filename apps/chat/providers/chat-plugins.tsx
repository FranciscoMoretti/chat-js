"use client";
import type { ReactNode } from "react";
import { Plugins } from "@/lib/ui-slots";
import { installedChatPlugins } from "@/chatjs/generated/installed-chat-ui";

export const ChatPlugins = ({ children }: { readonly children: ReactNode }) => (
  <Plugins plugins={installedChatPlugins}>{children}</Plugins>
);
