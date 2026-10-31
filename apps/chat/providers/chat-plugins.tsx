"use client";
import type { ReactNode } from "react";
import { Plugins } from "@/chatjs/core/ui/slots";
import { chatPlugins } from "@/integrations/chat/ui";

export const ChatPlugins = ({ children }: { readonly children: ReactNode }) => (
  <Plugins plugins={chatPlugins}>{children}</Plugins>
);
